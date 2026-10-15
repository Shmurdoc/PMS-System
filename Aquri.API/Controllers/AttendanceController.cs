using Aquri.Application.Attendance;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Aquri.API.Controllers
{
    /// <summary>Staff time tracking — clock-in/out, status corrections, and hours worked.</summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    [Authorize]
    public class AttendanceController : ControllerBase
    {
        private readonly IMediator _mediator;

        public AttendanceController(IMediator mediator) => _mediator = mediator;

        /// <summary>Records a clock-in (or an absent/no-show entry) for a staff member.</summary>
        [HttpPost]
        [Authorize(Roles = "admin,manager,front_desk")]
        [ProducesResponseType(typeof(AttendanceDto), StatusCodes.Status201Created)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<AttendanceDto>> Create([FromBody] CreateAttendanceCommand command)
        {
            var result = await _mediator.Send(command);
            if (!result.Success)
                return BadRequest(result.Error);

            return CreatedAtAction(nameof(Get), new { id = result.Data!.Id, version = "1.0" }, result.Data);
        }

        /// <summary>Fetches one attendance record by id.</summary>
        [HttpGet("{id:int}")]
        [ProducesResponseType(typeof(AttendanceDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<AttendanceDto>> Get(int id)
        {
            var result = await _mediator.Send(new GetAttendanceRecordQuery(id));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Lists attendance records, optionally filtered by property, staff member, date, and status.</summary>
        [HttpGet]
        [ProducesResponseType(typeof(List<AttendanceDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<List<AttendanceDto>>> List(
            [FromQuery] int? propertyId,
            [FromQuery] int? userId,
            [FromQuery] DateTime? date,
            [FromQuery] string? status)
        {
            var records = await _mediator.Send(new GetAttendanceRecordsQuery(propertyId, userId, date, status));
            return Ok(records);
        }

        /// <summary>Clocks out, transitions status, and updates notes. Omitted fields keep their current values.</summary>
        [HttpPut("{id:int}")]
        [Authorize(Roles = "admin,manager,front_desk")]
        [ProducesResponseType(typeof(AttendanceDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<AttendanceDto>> Update(int id, [FromBody] UpdateAttendanceCommand command)
        {
            var result = await _mediator.Send(command with { Id = id });
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Removes an attendance record (admin correction).</summary>
        [HttpDelete("{id:int}")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _mediator.Send(new DeleteAttendanceCommand(id));
            if (result.NotFound)
                return NotFound();
            return NoContent();
        }
    }
}
