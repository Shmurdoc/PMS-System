using Aquri.Application.AiWorkflows;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Aquri.API.Controllers
{
    /// <summary>Rules-based automations from the AI tab — create, edit, retire.</summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    [Authorize(Roles = "admin,manager")]
    public class WorkflowsController : ControllerBase
    {
        private readonly IMediator _mediator;

        public WorkflowsController(IMediator mediator) => _mediator = mediator;

        /// <summary>Lists all workflows, newest first.</summary>
        [HttpGet]
        [ProducesResponseType(typeof(List<WorkflowDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<List<WorkflowDto>>> List()
        {
            var workflows = await _mediator.Send(new GetWorkflowsQuery());
            return Ok(workflows);
        }

        /// <summary>Creates a workflow.</summary>
        [HttpPost]
        [ProducesResponseType(typeof(WorkflowDto), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<WorkflowDto>> Create([FromBody] CreateWorkflowCommand command)
        {
            var result = await _mediator.Send(command);
            if (!result.Success)
                return BadRequest(result.Error);
            return CreatedAtAction(nameof(List), new { version = "1.0" }, result.Data);
        }

        /// <summary>Edits a workflow — absent fields keep their current value.</summary>
        [HttpPut("{id:int}")]
        [ProducesResponseType(typeof(WorkflowDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<WorkflowDto>> Update(int id, [FromBody] UpdateWorkflowCommand command)
        {
            var result = await _mediator.Send(command with { Id = id });
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Deletes a workflow.</summary>
        [HttpDelete("{id:int}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _mediator.Send(new DeleteWorkflowCommand(id));
            if (result.NotFound)
                return NotFound();
            return NoContent();
        }
    }
}
