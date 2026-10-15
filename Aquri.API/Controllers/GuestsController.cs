using Aquri.Application.Guests;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Aquri.API.Controllers
{
    /// <summary>Guest directory — registration, lookup, and profile edits.</summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    [Authorize]
    public class GuestsController : ControllerBase
    {
        private readonly IMediator _mediator;

        public GuestsController(IMediator mediator) => _mediator = mediator;

        /// <summary>Registers a new guest.</summary>
        [HttpPost]
        [Authorize(Roles = "admin,manager,front_desk")]
        [ProducesResponseType(typeof(GuestDto), StatusCodes.Status201Created)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<GuestDto>> Create([FromBody] CreateGuestCommand command)
        {
            var result = await _mediator.Send(command);
            if (!result.Success)
                return BadRequest(result.Error);

            return CreatedAtAction(nameof(Get), new { id = result.Data!.Id, version = "1.0" }, result.Data);
        }

        /// <summary>Fetches one guest by id.</summary>
        [HttpGet("{id:int}")]
        [ProducesResponseType(typeof(GuestDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<GuestDto>> Get(int id)
        {
            var result = await _mediator.Send(new GetGuestQuery(id));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Lists guests, optionally filtered by name/email search term.</summary>
        [HttpGet]
        [ProducesResponseType(typeof(List<GuestDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<List<GuestDto>>> List([FromQuery] string? search)
        {
            var guests = await _mediator.Send(new GetGuestsQuery(search));
            return Ok(guests);
        }

        /// <summary>Edits a guest's profile.</summary>
        [HttpPut("{id:int}")]
        [Authorize(Roles = "admin,manager,front_desk")]
        [ProducesResponseType(typeof(GuestDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<GuestDto>> Update(int id, [FromBody] UpdateGuestCommand command)
        {
            var result = await _mediator.Send(command with { Id = id });
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>
        /// Deletes a guest (admin,manager only). Conflicts (409) protect guests
        /// referenced by bookings, invoices, or payments.
        /// </summary>
        [HttpDelete("{id:int}")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status409Conflict)]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _mediator.Send(new DeleteGuestCommand(id));
            if (result.NotFound)
                return NotFound();
            if (result.Conflict)
                return Conflict(result.Error);
            return NoContent();
        }
    }
}
