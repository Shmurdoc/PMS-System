using Aquri.Application.RatePlans;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Aquri.API.Controllers
{
    /// <summary>Pricing plans — seasons, base rates, and stay restrictions.</summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    [Authorize]
    public class RatePlansController : ControllerBase
    {
        private readonly IMediator _mediator;

        public RatePlansController(IMediator mediator) => _mediator = mediator;

        /// <summary>Creates a pricing plan.</summary>
        [HttpPost]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(typeof(RatePlanDto), StatusCodes.Status201Created)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<RatePlanDto>> Create([FromBody] CreateRatePlanCommand command)
        {
            var result = await _mediator.Send(command);
            if (!result.Success)
                return BadRequest(result.Error);

            return CreatedAtAction(nameof(Get), new { id = result.Data!.Id, version = "1.0" }, result.Data);
        }

        /// <summary>Fetches one rate plan by id.</summary>
        [HttpGet("{id:int}")]
        [ProducesResponseType(typeof(RatePlanDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<RatePlanDto>> Get(int id)
        {
            var result = await _mediator.Send(new GetRatePlanQuery(id));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Lists rate plans, optionally filtered by property and active flag.</summary>
        [HttpGet]
        [ProducesResponseType(typeof(List<RatePlanDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<List<RatePlanDto>>> List([FromQuery] int? propertyId, [FromQuery] bool? active)
        {
            var plans = await _mediator.Send(new GetRatePlansQuery(propertyId, active));
            return Ok(plans);
        }

        /// <summary>Edits a plan's rate, room types, restrictions, and active flag.</summary>
        [HttpPut("{id:int}")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(typeof(RatePlanDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<RatePlanDto>> Update(int id, [FromBody] UpdateRatePlanCommand command)
        {
            var result = await _mediator.Send(command with { Id = id });
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Deletes a pricing plan.</summary>
        [HttpDelete("{id:int}")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _mediator.Send(new DeleteRatePlanCommand(id));
            if (result.NotFound)
                return NotFound();
            return NoContent();
        }
    }
}
