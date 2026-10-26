using Aquri.Application.Common.Interfaces;
using Aquri.Application.Payroll;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Aquri.API.Controllers
{
    /// <summary>
    /// Payroll: compensation setup, run generation, approval, and payment.
    /// Approval and payment are admin-only and the two-person rule is enforced
    /// in the domain, so a manager who drafts a run cannot also sign it off.
    /// </summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    [Authorize]
    public class PayrollController : ControllerBase
    {
        private readonly IMediator _mediator;
        private readonly ICurrentUser _currentUser;

        public PayrollController(IMediator mediator, ICurrentUser currentUser)
        {
            _mediator = mediator;
            _currentUser = currentUser;
        }

        /// <summary>Lists payroll runs, newest period first.</summary>
        [HttpGet("runs")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(typeof(List<PayrollRunDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<List<PayrollRunDto>>> ListRuns(
            [FromQuery] int? propertyId, [FromQuery] string? status, [FromQuery] int? year)
        {
            var runs = await _mediator.Send(new GetPayrollRunsQuery(propertyId, status, year));
            return Ok(runs);
        }

        /// <summary>One run with its payslips.</summary>
        [HttpGet("runs/{id:int}")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(typeof(PayrollRunDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<PayrollRunDto>> GetRun(int id)
        {
            var result = await _mediator.Send(new GetPayrollRunQuery(id));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Builds a draft run from active packages and clocked hours.</summary>
        [HttpPost("runs")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(typeof(PayrollRunDto), StatusCodes.Status201Created)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
        public async Task<ActionResult<PayrollRunDto>> CreateRun([FromBody] CreatePayrollRunRequest request)
        {
            var result = await _mediator.Send(new CreatePayrollRunCommand(
                request.PropertyId,
                request.PeriodStart,
                request.PeriodEnd,
                _currentUser.UserName,
                request.RebuildExisting));

            if (result.NotFound)
                return NotFound();
            if (result.Conflict)
                return Conflict(result.Error);
            if (!result.Success)
                return BadRequest(result.Error);

            return CreatedAtAction(nameof(GetRun), new { id = result.Data!.Id, version = "1.0" }, result.Data);
        }

        /// <summary>Freezes a draft run. Admin only, and never the person who created it.</summary>
        [HttpPost("runs/{id:int}/approve")]
        [Authorize(Roles = "admin")]
        [ProducesResponseType(typeof(PayrollRunDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
        public async Task<ActionResult<PayrollRunDto>> Approve(int id)
        {
            var result = await _mediator.Send(new ApprovePayrollRunCommand(id));
            if (result.NotFound)
                return NotFound();
            if (result.Conflict)
                return Conflict(result.Error);
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Records payment of an approved run. Admin only.</summary>
        [HttpPost("runs/{id:int}/pay")]
        [Authorize(Roles = "admin")]
        [ProducesResponseType(typeof(PayrollRunDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
        public async Task<ActionResult<PayrollRunDto>> Pay(int id)
        {
            var result = await _mediator.Send(new MarkPayrollRunPaidCommand(id));
            if (result.NotFound)
                return NotFound();
            if (result.Conflict)
                return Conflict(result.Error);
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Cancels an unpaid run. Paid runs need an adjustment.</summary>
        [HttpPost("runs/{id:int}/cancel")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(typeof(PayrollRunDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
        public async Task<ActionResult<PayrollRunDto>> Cancel(int id, [FromBody] CancelPayrollRunRequest request)
        {
            var result = await _mediator.Send(new CancelPayrollRunCommand(id, request.Reason));
            if (result.NotFound)
                return NotFound();
            if (result.Conflict)
                return Conflict(result.Error);
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>
        /// Payslip history. Admin and manager can read anyone in scope; every
        /// other role is limited to their own slips, whatever they ask for.
        /// </summary>
        [HttpGet("payslips")]
        [ProducesResponseType(typeof(List<PayslipDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<List<PayslipDto>>> ListPayslips(
            [FromQuery] int? propertyId,
            [FromQuery] int? userId,
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to)
        {
            var role = _currentUser.UserRole ?? string.Empty;
            var canSeeAll = role is "admin" or "manager";
            var effectiveUserId = canSeeAll ? userId : _currentUser.UserId;

            var slips = await _mediator.Send(new GetPayslipsQuery(
                propertyId, effectiveUserId, from, to, PublishedOnly: !canSeeAll));
            return Ok(slips);
        }

        /// <summary>Active pay packages. Managers can read them to sanity-check a run.</summary>
        [HttpGet("compensations")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(typeof(List<CompensationDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<List<CompensationDto>>> ListCompensations(
            [FromQuery] int? propertyId, [FromQuery] bool activeOnly = true)
        {
            var rows = await _mediator.Send(new GetCompensationsQuery(propertyId, activeOnly));
            return Ok(rows);
        }

        /// <summary>Sets a staff member's pay package. Admin only, because it moves money.</summary>
        [HttpPut("compensations")]
        [Authorize(Roles = "admin")]
        [ProducesResponseType(typeof(CompensationDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<CompensationDto>> UpsertCompensation([FromBody] UpsertCompensationRequest request)
        {
            var result = await _mediator.Send(new UpsertCompensationCommand(
                request.PropertyId,
                request.UserId,
                request.PayType,
                request.BaseAmount,
                request.OvertimeMultiplier,
                request.StandardHours,
                request.Allowances,
                request.OtherDeductions,
                request.EffectiveFrom));

            if (result.NotFound)
                return NotFound();
            if (result.Conflict)
                return Conflict(result.Error);
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }
    }
}
