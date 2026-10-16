using Aquri.Application.AiInsights;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Aquri.API.Controllers
{
    /// <summary>AI insights — revenue nudges, staffing warnings, maintenance flags.</summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    [Authorize(Roles = "admin,manager")]
    public class AiInsightsController : ControllerBase
    {
        private readonly IMediator _mediator;

        public AiInsightsController(IMediator mediator) => _mediator = mediator;

        [HttpGet]
        [ProducesResponseType(typeof(List<AiInsightDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<List<AiInsightDto>>> List([FromQuery] int? propertyId)
        {
            var insights = await _mediator.Send(new GetAiInsightsQuery(propertyId));
            return Ok(insights);
        }

        /// <summary>Creates an AI insight (dismissed starts as not acted on).</summary>
        [HttpPost]
        [ProducesResponseType(typeof(AiInsightDto), StatusCodes.Status201Created)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<AiInsightDto>> Create([FromBody] CreateAiInsightCommand command)
        {
            var result = await _mediator.Send(command);
            if (!result.Success)
                return BadRequest(result.Error);

            return CreatedAtAction(nameof(List), new { propertyId = result.Data!.PropertyId, version = "1.0" }, result.Data);
        }

        /// <summary>Sparse update — any subset of fields.</summary>
        [HttpPut("{id:int}")]
        [ProducesResponseType(typeof(AiInsightDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<AiInsightDto>> Update(int id, [FromBody] UpdateAiInsightCommand command)
        {
            var result = await _mediator.Send(command with { Id = id });
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        [HttpDelete("{id:int}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _mediator.Send(new DeleteAiInsightCommand(id));
            if (result.NotFound)
                return NotFound();
            return NoContent();
        }
    }
}
