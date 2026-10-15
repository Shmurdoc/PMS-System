using Aquri.Application.Tickets;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Aquri.API.Controllers
{
    /// <summary>Maintenance/support tickets — creation, workflow, assignment, comments.</summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    [Authorize]
    public class TicketsController : ControllerBase
    {
        private readonly IMediator _mediator;

        public TicketsController(IMediator mediator) => _mediator = mediator;

        /// <summary>Opens a new ticket.</summary>
        [HttpPost]
        [Authorize(Roles = "admin,manager,front_desk,housekeeping,maintenance")]
        [ProducesResponseType(typeof(TicketDto), StatusCodes.Status201Created)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<TicketDto>> Create([FromBody] CreateTicketCommand command)
        {
            var result = await _mediator.Send(command);
            if (!result.Success)
                return BadRequest(result.Error);

            return CreatedAtAction(nameof(Get), new { id = result.Data!.Id, version = "1.0" }, result.Data);
        }

        /// <summary>Fetches one ticket with its comment thread.</summary>
        [HttpGet("{id:int}")]
        [ProducesResponseType(typeof(TicketDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<TicketDto>> Get(int id)
        {
            var result = await _mediator.Send(new GetTicketQuery(id));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Lists tickets for a property, optionally filtered by status/priority.</summary>
        [HttpGet]
        [ProducesResponseType(typeof(List<TicketDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<List<TicketDto>>> List(
            [FromQuery] int propertyId, [FromQuery] string? status, [FromQuery] string? priority)
        {
            var tickets = await _mediator.Send(new GetTicketsQuery(propertyId, status, priority));
            return Ok(tickets);
        }

        /// <summary>Transitions a ticket through its workflow.</summary>
        [HttpPatch("{id:int}/status")]
        [Authorize(Roles = "admin,manager,front_desk,housekeeping,maintenance")]
        [ProducesResponseType(typeof(TicketDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<TicketDto>> ChangeStatus(int id, [FromBody] string newStatus)
        {
            var result = await _mediator.Send(new ChangeTicketStatusCommand(id, newStatus));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Assigns a ticket to a staff member.</summary>
        [HttpPost("{id:int}/assign")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(typeof(TicketDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<TicketDto>> Assign(int id, [FromBody] int assigneeId)
        {
            var result = await _mediator.Send(new AssignTicketCommand(id, assigneeId));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Adds a comment to a ticket thread.</summary>
        [HttpPost("{id:int}/comments")]
        [Authorize(Roles = "admin,manager,front_desk,housekeeping,maintenance")]
        [ProducesResponseType(typeof(TicketDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<TicketDto>> AddComment(int id, [FromBody] AddTicketCommentCommand command)
        {
            var result = await _mediator.Send(command with { Id = id });
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Deletes a ticket and its comment thread (admin,manager only).</summary>
        [HttpDelete("{id:int}")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _mediator.Send(new DeleteTicketCommand(id));
            if (result.NotFound)
                return NotFound();
            return NoContent();
        }
    }
}
