using Aquri.Application.MaintenanceRequests;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Aquri.API.Controllers
{
    /// <summary>Property maintenance requests — raise, triage, and close work orders.</summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    [Authorize]
    public class MaintenanceRequestsController : ControllerBase
    {
        private readonly IMediator _mediator;

        public MaintenanceRequestsController(IMediator mediator) => _mediator = mediator;

        /// <summary>Creates a maintenance request (defaults to pending / medium).</summary>
        [HttpPost]
        [Authorize(Roles = "admin,manager,front_desk,maintenance")]
        [ProducesResponseType(typeof(MaintenanceRequestDto), StatusCodes.Status201Created)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<MaintenanceRequestDto>> Create([FromBody] CreateMaintenanceRequestCommand command)
        {
            var result = await _mediator.Send(command);
            if (!result.Success)
                return BadRequest(result.Error);

            return CreatedAtAction(nameof(Get), new { id = result.Data!.Id, version = "1.0" }, result.Data);
        }

        /// <summary>Fetches one maintenance request by id.</summary>
        [HttpGet("{id:int}")]
        [ProducesResponseType(typeof(MaintenanceRequestDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<MaintenanceRequestDto>> Get(int id)
        {
            var result = await _mediator.Send(new GetMaintenanceRequestQuery(id));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Lists maintenance requests, optionally filtered by property, status, and priority.</summary>
        [HttpGet]
        [ProducesResponseType(typeof(List<MaintenanceRequestDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<List<MaintenanceRequestDto>>> List(
            [FromQuery] int? propertyId,
            [FromQuery] string? status,
            [FromQuery] string? priority)
        {
            var requests = await _mediator.Send(new GetMaintenanceRequestsQuery(propertyId, status, priority));
            return Ok(requests);
        }

        /// <summary>Sparse update — description, status, and/or priority.</summary>
        [HttpPut("{id:int}")]
        [Authorize(Roles = "admin,manager,front_desk,maintenance")]
        [ProducesResponseType(typeof(MaintenanceRequestDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<MaintenanceRequestDto>> Update(int id, [FromBody] UpdateMaintenanceRequestCommand command)
        {
            var result = await _mediator.Send(command with { Id = id });
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Deletes a maintenance request.</summary>
        [HttpDelete("{id:int}")]
        [Authorize(Roles = "admin,manager,front_desk,maintenance")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _mediator.Send(new DeleteMaintenanceRequestCommand(id));
            if (result.NotFound)
                return NotFound();
            return NoContent();
        }
    }
}
