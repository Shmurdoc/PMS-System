using Aquri.Application.Common.Interfaces;
using Aquri.Application.Expenses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Aquri.API.Controllers
{
    /// <summary>Staff expenses — submission, approval workflow, and reporting.</summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    [Authorize]
    public class ExpensesController : ControllerBase
    {
        private readonly IMediator _mediator;
        private readonly ICurrentUser _currentUser;

        public ExpensesController(IMediator mediator, ICurrentUser currentUser)
        {
            _mediator = mediator;
            _currentUser = currentUser;
        }

        /// <summary>Submits a new expense.</summary>
        [HttpPost]
        [Authorize(Roles = "admin,manager,front_desk,housekeeping,maintenance")]
        [ProducesResponseType(typeof(ExpenseDto), StatusCodes.Status201Created)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<ExpenseDto>> Create([FromBody] CreateExpenseRequest request)
        {
            var result = await _mediator.Send(request.ToCommand(_currentUser.UserName));
            if (!result.Success)
                return BadRequest(result.Error);

            return CreatedAtAction(nameof(Get), new { id = result.Data!.Id, version = "1.0" }, result.Data);
        }

        [HttpGet("{id:int}")]
        [ProducesResponseType(typeof(ExpenseDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<ExpenseDto>> Get(int id)
        {
            var result = await _mediator.Send(new GetExpenseQuery(id));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        [HttpGet]
        [ProducesResponseType(typeof(List<ExpenseDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<List<ExpenseDto>>> List(
            [FromQuery] int? propertyId, [FromQuery] string? status, [FromQuery] string? category)
        {
            var expenses = await _mediator.Send(new GetExpensesQuery(propertyId, status, category));
            return Ok(expenses);
        }

        [HttpPut("{id:int}")]
        [Authorize(Roles = "admin,manager,front_desk")]
        [ProducesResponseType(typeof(ExpenseDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<ExpenseDto>> Update(int id, [FromBody] UpdateExpenseCommand command)
        {
            var result = await _mediator.Send(command with { Id = id });
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        [HttpPost("{id:int}/approve")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(typeof(ExpenseDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<ExpenseDto>> Approve(int id)
        {
            var result = await _mediator.Send(new ApproveExpenseCommand(id, _currentUser.UserName));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        [HttpPost("{id:int}/reject")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(typeof(ExpenseDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<ExpenseDto>> Reject(int id)
        {
            var result = await _mediator.Send(new RejectExpenseCommand(id, _currentUser.UserName));
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
            var result = await _mediator.Send(new DeleteExpenseCommand(id));
            if (result.NotFound)
                return NotFound();
            return NoContent();
        }
    }

    /// <summary>Wire shape for expense creation; the submitted-by name comes from the JWT.</summary>
    public record CreateExpenseRequest(
        int PropertyId,
        string Category,
        decimal Amount,
        string Description,
        DateTime Date,
        string? ReceiptUrl,
        string? Vendor,
        string? PaymentMethod,
        string? Notes)
    {
        public CreateExpenseCommand ToCommand(string submittedBy) =>
            new(PropertyId, Category, Amount, Description, Date, submittedBy, ReceiptUrl, Vendor, PaymentMethod, Notes);
    }
}
