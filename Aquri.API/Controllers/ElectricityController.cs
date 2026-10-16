using Aquri.Application.Electricity;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Aquri.API.Controllers
{
    /// <summary>Meter readings — consumption, cost, and peak demand per zone.</summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    [Authorize]
    public class ElectricityController : ControllerBase
    {
        private readonly IMediator _mediator;

        public ElectricityController(IMediator mediator) => _mediator = mediator;

        [HttpPost]
        [Authorize(Roles = "admin,manager,front_desk,housekeeping,maintenance")]
        [ProducesResponseType(typeof(ElectricityRecordDto), StatusCodes.Status201Created)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<ElectricityRecordDto>> Create([FromBody] CreateElectricityRecordCommand command)
        {
            var result = await _mediator.Send(command);
            if (!result.Success)
                return BadRequest(result.Error);

            return CreatedAtAction(nameof(Get), new { id = result.Data!.Id, version = "1.0" }, result.Data);
        }

        [HttpGet("{id:int}")]
        [ProducesResponseType(typeof(ElectricityRecordDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<ElectricityRecordDto>> Get(int id)
        {
            var result = await _mediator.Send(new GetElectricityRecordQuery(id));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        [HttpGet]
        [ProducesResponseType(typeof(List<ElectricityRecordDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<List<ElectricityRecordDto>>> List(
            [FromQuery] int? propertyId, [FromQuery] string? zone)
        {
            var records = await _mediator.Send(new GetElectricityRecordsQuery(propertyId, zone));
            return Ok(records);
        }

        [HttpPut("{id:int}")]
        [Authorize(Roles = "admin,manager,front_desk")]
        [ProducesResponseType(typeof(ElectricityRecordDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<ElectricityRecordDto>> Update(int id, [FromBody] UpdateElectricityRecordCommand command)
        {
            var result = await _mediator.Send(command with { Id = id });
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        [HttpDelete("{id:int}")]
        [Authorize(Roles = "admin")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _mediator.Send(new DeleteElectricityRecordCommand(id));
            if (result.NotFound)
                return NotFound();
            return NoContent();
        }
    }
}
