using System.Security.Claims;
using Aquri.Application.AuditLogs;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Aquri.API.Controllers
{
    /// <summary>Immutable audit trail — write-once entries, never edited or deleted.</summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    [Authorize]
    public class AuditLogsController : ControllerBase
    {
        private readonly IMediator _mediator;

        public AuditLogsController(IMediator mediator) => _mediator = mediator;

        /// <summary>Records an audit trail entry. The acting user comes from claims.</summary>
        [HttpPost]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(typeof(AuditLogDto), StatusCodes.Status201Created)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<AuditLogDto>> Create([FromBody] CreateAuditLogCommand command)
        {
            var stamped = command with
            {
                UserId = CurrentUserId(),
                UserName = CurrentUserName(),
                UserRole = CurrentUserRole(),
                IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
            };

            var result = await _mediator.Send(stamped);
            if (!result.Success)
                return BadRequest(result.Error);

            return CreatedAtAction(nameof(Get), new { id = result.Data!.Id, version = "1.0" }, result.Data);
        }

        /// <summary>Fetches one audit log entry by id.</summary>
        [HttpGet("{id:int}")]
        [ProducesResponseType(typeof(AuditLogDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<AuditLogDto>> Get(int id)
        {
            var result = await _mediator.Send(new GetAuditLogQuery(id));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Lists audit log entries, newest first, optionally filtered.</summary>
        [HttpGet]
        [ProducesResponseType(typeof(List<AuditLogDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<List<AuditLogDto>>> List(
            [FromQuery] int? propertyId,
            [FromQuery] string? entityType,
            [FromQuery] string? entityId,
            [FromQuery] int? userId,
            [FromQuery] string? action)
        {
            var logs = await _mediator.Send(new GetAuditLogsQuery(propertyId, entityType, entityId, userId, action));
            return Ok(logs);
        }

        private int CurrentUserId() =>
            int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;

        private string CurrentUserName() =>
            User.FindFirstValue(ClaimTypes.Name) ?? string.Empty;

        private string CurrentUserRole() =>
            User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
    }
}
