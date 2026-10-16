using Aquri.Application.Bookings;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Aquri.API.Controllers
{
    /// <summary>Booking lifecycle — create, status transitions, deposits, and lookup.</summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    [Authorize]
    public class BookingsController : ControllerBase
    {
        private readonly IMediator _mediator;

        public BookingsController(IMediator mediator) => _mediator = mediator;

        /// <summary>Creates a new booking (checks room availability first).</summary>
        [HttpPost]
        [Authorize(Roles = "admin,manager,front_desk")]
        [ProducesResponseType(typeof(BookingDto), StatusCodes.Status201Created)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<BookingDto>> Create([FromBody] CreateBookingCommand command)
        {
            var result = await _mediator.Send(command);
            if (!result.Success)
                return BadRequest(result.Error);

            return CreatedAtAction(nameof(Get), new { id = result.Data!.Id, version = "1.0" }, result.Data);
        }

        [HttpGet("{id:int}")]
        [ProducesResponseType(typeof(BookingDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<BookingDto>> Get(int id)
        {
            var result = await _mediator.Send(new GetBookingQuery(id));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        [HttpGet]
        [ProducesResponseType(typeof(List<BookingDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<List<BookingDto>>> List([FromQuery] int propertyId, [FromQuery] string? status)
        {
            var bookings = await _mediator.Send(new GetBookingsQuery(propertyId, status));
            return Ok(bookings);
        }

        [HttpPatch("{id:int}/status")]
        [Authorize(Roles = "admin,manager,front_desk")]
        [ProducesResponseType(typeof(BookingDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<BookingDto>> ChangeStatus(int id, [FromBody] string newStatus)
        {
            var result = await _mediator.Send(new ChangeBookingStatusCommand(id, newStatus));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        [HttpPost("{id:int}/deposit")]
        [Authorize(Roles = "admin,manager,front_desk")]
        [ProducesResponseType(typeof(BookingDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<BookingDto>> RecordDeposit(int id, [FromBody] decimal amount)
        {
            var result = await _mediator.Send(new RecordBookingDepositCommand(id, amount));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Deletes a booking (admin,manager only) and frees its room.</summary>
        [HttpDelete("{id:int}")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _mediator.Send(new DeleteBookingCommand(id));
            if (result.NotFound)
                return NotFound();
            return NoContent();
        }
    }
}
