using Aquri.Application.AuditLogs;
using Aquri.Application.Common.Interfaces;
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
        private readonly ICurrentUser _currentUser;

        public AuditLogsController(IMediator mediator, ICurrentUser currentUser)
        {
            _mediator = mediator;
            _currentUser = currentUser;
        }

        [HttpPost]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(typeof(AuditLogDto), StatusCodes.Status201Created)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<AuditLogDto>> Create([FromBody] CreateAuditLogCommand command)
        {
            var stamped = command with
            {
                UserId = _currentUser.UserId,
                UserName = _currentUser.UserName,
                UserRole = _currentUser.UserRole,
                IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
            };

            var result = await _mediator.Send(stamped);
            if (!result.Success)
                return BadRequest(result.Error);

            return CreatedAtAction(nameof(Get), new { id = result.Data!.Id, version = "1.0" }, result.Data);
        }

        [HttpGet("{id:int}")]
        [Authorize(Roles = "admin,manager")]
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

        [HttpGet]
        [Authorize(Roles = "admin,manager")]
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
    }
}
