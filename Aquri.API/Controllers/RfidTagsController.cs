using Aquri.Application.RfidTags;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Aquri.API.Controllers
{
    /// <summary>
    /// Dual NFC tag system: guest tags resolve stay context, staff badges punch
    /// attendance. Issuance and revocation are admin/manager operations.
    /// </summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    [Authorize]
    public class RfidTagsController : ControllerBase
    {
        private readonly IMediator _mediator;

        public RfidTagsController(IMediator mediator) => _mediator = mediator;

        /// <summary>Lists a property's tags, optionally filtered by kind.</summary>
        [HttpGet]
        [ProducesResponseType(typeof(List<RfidTagDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<List<RfidTagDto>>> List(
            [FromQuery] int propertyId, [FromQuery] string? kind)
        {
            var tags = await _mediator.Send(new GetRfidTagsQuery(propertyId, kind));
            return Ok(tags);
        }

        /// <summary>Issues a tag — staff badges bind to a user, guest tags to a booking.</summary>
        [HttpPost]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(typeof(RfidTagDto), StatusCodes.Status201Created)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status409Conflict)]
        public async Task<ActionResult<RfidTagDto>> Issue([FromBody] IssueRfidTagRequest request)
        {
            var result = await _mediator.Send(request.ToCommand());
            if (result.Conflict)
                return Conflict(result.Error);
            if (!result.Success)
                return BadRequest(result.Error);

            return CreatedAtAction(
                nameof(List),
                new { propertyId = result.Data!.PropertyId, version = "1.0" },
                result.Data);
        }

        /// <summary>Revokes a tag by marking it blocked; taps stop resolving immediately.</summary>
        [HttpPost("{id:int}/revoke")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(typeof(RfidTagDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status409Conflict)]
        public async Task<ActionResult<RfidTagDto>> Revoke(int id, [FromBody] RevokeRfidTagRequest? request)
        {
            var result = await _mediator.Send(new RevokeRfidTagCommand(id, request?.Notes));
            if (result.NotFound)
                return NotFound();
            if (result.Conflict)
                return Conflict(result.Error);
            if (!result.Success)
                return BadRequest(result.Error);

            return Ok(result.Data);
        }

        /// <summary>
        /// Staff badge tap: toggles today's attendance in/out. Timestamps are
        /// stamped server-side; a re-read within 3s reports the current punch
        /// instead of toggling.
        /// </summary>
        [HttpPost("tap/staff")]
        [Authorize(Roles = "admin,manager,front_desk,housekeeping,maintenance")]
        [ProducesResponseType(typeof(StaffTapResultDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<StaffTapResultDto>> TapStaff([FromBody] TapRequest request)
        {
            var result = await _mediator.Send(new RecordStaffTapCommand(
                request.PropertyId, request.TagNumber, DateTime.UtcNow));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);

            return Ok(result.Data);
        }

        /// <summary>
        /// Guest tag tap: resolves guest, room, and booking status and stamps
        /// the tag's last-used time. No attendance is written.
        /// </summary>
        [HttpPost("tap/guest")]
        [Authorize(Roles = "admin,manager,front_desk,housekeeping,maintenance")]
        [ProducesResponseType(typeof(GuestTapContextDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<GuestTapContextDto>> TapGuest([FromBody] TapRequest request)
        {
            var result = await _mediator.Send(new ResolveGuestTapCommand(
                request.PropertyId, request.TagNumber, DateTime.UtcNow));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);

            return Ok(result.Data);
        }
    }

    /// <summary>Wire shape for issuing a tag; kind carries guest|staff.</summary>
    public record IssueRfidTagRequest(
        int PropertyId,
        string Kind,
        string TagNumber,
        int? UserId,
        int? BookingId,
        string? AccessLevel,
        DateTime? ExpiresAt,
        string? Notes)
    {
        public IssueRfidTagCommand ToCommand() =>
            new(PropertyId, Kind, TagNumber, UserId, BookingId, AccessLevel, ExpiresAt, Notes);
    }

    public record RevokeRfidTagRequest(string? Notes);

    /// <summary>
    /// Tap wire shape. Deliberately has no timestamp field — clients cannot
    /// backdate punches; the controller stamps every tap with server time.
    /// </summary>
    public record TapRequest(int PropertyId, string TagNumber);
}
