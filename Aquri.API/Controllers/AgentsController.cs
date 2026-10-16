using Aquri.Application.AiAgents;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Aquri.API.Controllers
{
    /// <summary>The six AI workers — status, run history, and manual execution.</summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    [Authorize(Roles = "admin,manager")]
    public class AgentsController : ControllerBase
    {
        private readonly IMediator _mediator;

        public AgentsController(IMediator mediator) => _mediator = mediator;

        [HttpGet]
        [ProducesResponseType(typeof(List<AgentDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<List<AgentDto>>> List()
        {
            var agents = await _mediator.Send(new GetAgentsQuery());
            return Ok(agents);
        }

        /// <summary>Pauses, resumes, or stops an agent.</summary>
        [HttpPatch("{id:int}/status")]
        [ProducesResponseType(typeof(AgentDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<AgentDto>> ChangeStatus(int id, [FromBody] UpdateAgentStatusCommand command)
        {
            var result = await _mediator.Send(command with { Id = id });
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        [HttpPost("{id:int}/run")]
        [ProducesResponseType(typeof(RunAgentResultDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<RunAgentResultDto>> Run(int id)
        {
            var result = await _mediator.Send(new RunAgentCommand(id));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }
    }
}
