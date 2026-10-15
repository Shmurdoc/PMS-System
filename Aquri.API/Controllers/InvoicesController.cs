using Aquri.Application.Invoices;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Aquri.API.Controllers
{
    /// <summary>Tax invoices — creation, line items, payment recording, and lookup.</summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    [Authorize]
    public class InvoicesController : ControllerBase
    {
        private readonly IMediator _mediator;

        public InvoicesController(IMediator mediator) => _mediator = mediator;

        /// <summary>Creates a tax invoice with line items; totals computed server-side.</summary>
        [HttpPost]
        [Authorize(Roles = "admin,manager,front_desk")]
        [ProducesResponseType(typeof(InvoiceDto), StatusCodes.Status201Created)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<InvoiceDto>> Create([FromBody] CreateInvoiceCommand command)
        {
            var result = await _mediator.Send(command);
            if (!result.Success)
                return BadRequest(result.Error);

            return CreatedAtAction(nameof(Get), new { id = result.Data!.Id, version = "1.0" }, result.Data);
        }

        /// <summary>Fetches one invoice with its line items.</summary>
        [HttpGet("{id:int}")]
        [ProducesResponseType(typeof(InvoiceDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<InvoiceDto>> Get(int id)
        {
            var result = await _mediator.Send(new GetInvoiceQuery(id));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Lists invoices for a property, optionally filtered by status.</summary>
        [HttpGet]
        [ProducesResponseType(typeof(List<InvoiceDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<List<InvoiceDto>>> List([FromQuery] int propertyId, [FromQuery] string? status)
        {
            var invoices = await _mediator.Send(new GetInvoicesQuery(propertyId, status));
            return Ok(invoices);
        }

        /// <summary>Adds a line item to a draft/sent invoice; totals recompute.</summary>
        [HttpPost("{id:int}/items")]
        [Authorize(Roles = "admin,manager,front_desk")]
        [ProducesResponseType(typeof(InvoiceDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<InvoiceDto>> AddItem(int id, [FromBody] AddInvoiceItemCommand command)
        {
            var result = await _mediator.Send(command with { InvoiceId = id });
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Records a payment against an invoice; flips to paid when fully settled.</summary>
        [HttpPost("{id:int}/payments")]
        [Authorize(Roles = "admin,manager,front_desk")]
        [ProducesResponseType(typeof(InvoiceDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<InvoiceDto>> RecordPayment(int id, [FromBody] RecordInvoicePaymentCommand command)
        {
            var result = await _mediator.Send(command with { Id = id });
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Deletes an invoice (admin,manager only); its payments are detached, not destroyed.</summary>
        [HttpDelete("{id:int}")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _mediator.Send(new DeleteInvoiceCommand(id));
            if (result.NotFound)
                return NotFound();
            return NoContent();
        }
    }
}
