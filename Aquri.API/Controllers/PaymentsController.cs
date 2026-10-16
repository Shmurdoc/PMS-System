using Aquri.Application.Payments;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Aquri.API.Controllers
{
    /// <summary>Payment processing — create, complete, refund, and listing.</summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    [Authorize]
    public class PaymentsController : ControllerBase
    {
        private readonly IMediator _mediator;

        public PaymentsController(IMediator mediator) => _mediator = mediator;

        [HttpPost]
        [Authorize(Roles = "admin,manager,front_desk")]
        [ProducesResponseType(typeof(PaymentDto), StatusCodes.Status201Created)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<PaymentDto>> Create([FromBody] CreatePaymentCommand command)
        {
            var result = await _mediator.Send(command);
            if (!result.Success)
                return BadRequest(result.Error);

            return CreatedAtAction(nameof(List), new { propertyId = command.PropertyId, version = "1.0" }, result.Data);
        }

        [HttpPost("{id:int}/complete")]
        [Authorize(Roles = "admin,manager,front_desk")]
        [ProducesResponseType(typeof(PaymentDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<PaymentDto>> Complete(int id, [FromBody] string? transactionId)
        {
            var result = await _mediator.Send(new CompletePaymentCommand(id, transactionId));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Refunds a completed payment — one-way transition.</summary>
        [HttpPost("{id:int}/refund")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(typeof(PaymentDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<PaymentDto>> Refund(int id)
        {
            var result = await _mediator.Send(new RefundPaymentCommand(id));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        [HttpGet]
        [ProducesResponseType(typeof(List<PaymentDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<List<PaymentDto>>> List([FromQuery] int propertyId, [FromQuery] string? status)
        {
            var payments = await _mediator.Send(new GetPaymentsQuery(propertyId, status));
            return Ok(payments);
        }
    }
}
