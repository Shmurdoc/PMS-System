using Aquri.Application.TaxConfigs;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Aquri.API.Controllers
{
    /// <summary>Tax and levy rules (VAT, tourism levy, service charge) with validity windows.</summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    [Authorize]
    public class TaxConfigsController : ControllerBase
    {
        private readonly IMediator _mediator;

        public TaxConfigsController(IMediator mediator) => _mediator = mediator;

        /// <summary>Creates a tax or levy rule.</summary>
        [HttpPost]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(typeof(TaxConfigDto), StatusCodes.Status201Created)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<TaxConfigDto>> Create([FromBody] CreateTaxConfigCommand command)
        {
            var result = await _mediator.Send(command);
            if (!result.Success)
                return BadRequest(result.Error);

            return CreatedAtAction(nameof(Get), new { id = result.Data!.Id, version = "1.0" }, result.Data);
        }

        /// <summary>Fetches one tax config by id.</summary>
        [HttpGet("{id:int}")]
        [ProducesResponseType(typeof(TaxConfigDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<TaxConfigDto>> Get(int id)
        {
            var result = await _mediator.Send(new GetTaxConfigQuery(id));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Lists tax configs, optionally filtered by property, type, and active state.</summary>
        [HttpGet]
        [ProducesResponseType(typeof(List<TaxConfigDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<List<TaxConfigDto>>> List(
            [FromQuery] int? propertyId,
            [FromQuery] string? type,
            [FromQuery] bool? active)
        {
            var taxes = await _mediator.Send(new GetTaxConfigsQuery(propertyId, type, active));
            return Ok(taxes);
        }

        /// <summary>Sparse update — rate, included flag, window end, deactivation.</summary>
        [HttpPut("{id:int}")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(typeof(TaxConfigDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<TaxConfigDto>> Update(int id, [FromBody] UpdateTaxConfigCommand command)
        {
            var result = await _mediator.Send(command with { Id = id });
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Deletes a tax config.</summary>
        [HttpDelete("{id:int}")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _mediator.Send(new DeleteTaxConfigCommand(id));
            if (result.NotFound)
                return NotFound();
            return NoContent();
        }
    }
}
