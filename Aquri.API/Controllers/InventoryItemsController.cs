using Aquri.Application.Inventory;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Aquri.API.Controllers
{
    /// <summary>Stock items — CRUD, usage adjustments, and restocking.</summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    [Authorize]
    public class InventoryItemsController : ControllerBase
    {
        private readonly IMediator _mediator;

        public InventoryItemsController(IMediator mediator) => _mediator = mediator;

        /// <summary>Adds a new stock item.</summary>
        [HttpPost]
        [Authorize(Roles = "admin,manager,housekeeping")]
        [ProducesResponseType(typeof(InventoryItemDto), StatusCodes.Status201Created)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<InventoryItemDto>> Create([FromBody] CreateInventoryItemCommand command)
        {
            var result = await _mediator.Send(command);
            if (!result.Success)
                return BadRequest(result.Error);

            return CreatedAtAction(nameof(Get), new { id = result.Data!.Id, version = "1.0" }, result.Data);
        }

        /// <summary>Fetches one stock item by id.</summary>
        [HttpGet("{id:int}")]
        [ProducesResponseType(typeof(InventoryItemDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<InventoryItemDto>> Get(int id)
        {
            var result = await _mediator.Send(new GetInventoryItemQuery(id));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Lists stock items, optionally filtered by property, category, or name.</summary>
        [HttpGet]
        [ProducesResponseType(typeof(List<InventoryItemDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<List<InventoryItemDto>>> List(
            [FromQuery] int? propertyId, [FromQuery] string? category, [FromQuery] string? search)
        {
            var items = await _mediator.Send(new GetInventoryItemsQuery(propertyId, category, search));
            return Ok(items);
        }

        /// <summary>Edits a stock item's details.</summary>
        [HttpPut("{id:int}")]
        [Authorize(Roles = "admin,manager,housekeeping")]
        [ProducesResponseType(typeof(InventoryItemDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<InventoryItemDto>> Update(int id, [FromBody] UpdateInventoryItemCommand command)
        {
            var result = await _mediator.Send(command with { Id = id });
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Applies a signed stock adjustment (negative for usage).</summary>
        [HttpPost("{id:int}/adjust")]
        [Authorize(Roles = "admin,manager,housekeeping")]
        [ProducesResponseType(typeof(InventoryItemDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<InventoryItemDto>> Adjust(int id, [FromBody] AdjustQuantityRequest request)
        {
            var result = await _mediator.Send(new AdjustInventoryQuantityCommand(id, request.Delta));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Records a delivery: bumps quantity and stamps the restock date.</summary>
        [HttpPost("{id:int}/restock")]
        [Authorize(Roles = "admin,manager,housekeeping")]
        [ProducesResponseType(typeof(InventoryItemDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<InventoryItemDto>> Restock(int id, [FromBody] RestockRequest request)
        {
            var result = await _mediator.Send(new RestockInventoryItemCommand(id, request.QuantityAdded));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Removes a stock item.</summary>
        [HttpDelete("{id:int}")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _mediator.Send(new DeleteInventoryItemCommand(id));
            if (result.NotFound)
                return NotFound();
            return NoContent();
        }
    }

    /// <summary>Wire shape for a signed quantity adjustment.</summary>
    public record AdjustQuantityRequest(int Delta);

    /// <summary>Wire shape for a restock delivery.</summary>
    public record RestockRequest(int QuantityAdded);
}
