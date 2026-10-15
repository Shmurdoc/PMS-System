using Aquri.Application.Shifts;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Aquri.API.Controllers
{
    /// <summary>Staff shift scheduling — roster, breaks, status changes, and swaps.</summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    [Authorize]
    public class ShiftsController : ControllerBase
    {
        private readonly IMediator _mediator;

        public ShiftsController(IMediator mediator) => _mediator = mediator;

        /// <summary>Schedules a new shift for a staff member.</summary>
        [HttpPost]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(typeof(ShiftDto), StatusCodes.Status201Created)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<ShiftDto>> Create([FromBody] CreateShiftCommand command)
        {
            var result = await _mediator.Send(command);
            if (!result.Success)
                return BadRequest(result.Error);

            return CreatedAtAction(nameof(Get), new { id = result.Data!.Id, version = "1.0" }, result.Data);
        }

        /// <summary>Fetches one shift by id.</summary>
        [HttpGet("{id:int}")]
        [ProducesResponseType(typeof(ShiftDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<ShiftDto>> Get(int id)
        {
            var result = await _mediator.Send(new GetShiftQuery(id));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Lists shifts, optionally filtered by property, staff member, date, and status.</summary>
        [HttpGet]
        [ProducesResponseType(typeof(List<ShiftDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<List<ShiftDto>>> List(
            [FromQuery] int? propertyId,
            [FromQuery] int? userId,
            [FromQuery] DateTime? date,
            [FromQuery] string? status)
        {
            var shifts = await _mediator.Send(new GetShiftsQuery(propertyId, userId, date, status));
            return Ok(shifts);
        }

        /// <summary>Edits a shift's break, overtime, notes, and department. Omitted fields keep their current values.</summary>
        [HttpPut("{id:int}")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(typeof(ShiftDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<ShiftDto>> Update(int id, [FromBody] UpdateShiftCommand command)
        {
            var result = await _mediator.Send(command with { Id = id });
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Moves a shift through its lifecycle: scheduled, completed, cancelled, or swapped.</summary>
        [HttpPut("{id:int}/status")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(typeof(ShiftDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<ShiftDto>> ChangeStatus(int id, [FromBody] ChangeShiftStatusCommand command)
        {
            var result = await _mediator.Send(command with { Id = id });
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Reassigns a shift to another staff member, keeping who-covered-what on the record.</summary>
        [HttpPut("{id:int}/swap")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(typeof(ShiftDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<ShiftDto>> Swap(int id, [FromBody] SwapShiftCommand command)
        {
            var result = await _mediator.Send(command with { Id = id });
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Removes a shift from the roster.</summary>
        [HttpDelete("{id:int}")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _mediator.Send(new DeleteShiftCommand(id));
            if (result.NotFound)
                return NotFound();
            return NoContent();
        }
    }
}
