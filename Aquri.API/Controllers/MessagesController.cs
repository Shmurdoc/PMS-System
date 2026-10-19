using System.Security.Claims;
using Aquri.Application.Messages;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Aquri.API.Controllers
{
    /// <summary>Staff chat — direct messages, channel posts, and system alerts.</summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    [Authorize]
    public class MessagesController : ControllerBase
    {
        private readonly IMediator _mediator;

        public MessagesController(IMediator mediator) => _mediator = mediator;

        [HttpPost]
        [ProducesResponseType(typeof(MessageDto), StatusCodes.Status201Created)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<MessageDto>> Create([FromBody] CreateMessageCommand command)
        {
            var stamped = command with
            {
                SenderId = CurrentUserId(),
                SenderName = CurrentUserName()
            };

            var result = await _mediator.Send(stamped);
            if (!result.Success)
                return BadRequest(result.Error);

            return CreatedAtAction(nameof(Get), new { id = result.Data!.Id, version = "1.0" }, result.Data);
        }

        [HttpGet("{id:int}")]
        [ProducesResponseType(typeof(MessageDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<MessageDto>> Get(int id)
        {
            var result = await _mediator.Send(new GetMessageQuery(id, CurrentUserId()));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Lists messages, optionally filtered by property, recipient, channel, and unread state.</summary>
        [HttpGet]
        [ProducesResponseType(typeof(List<MessageDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<List<MessageDto>>> List(
            [FromQuery] int? propertyId,
            [FromQuery] int? recipientId,
            [FromQuery] string? channelId,
            [FromQuery] bool? unreadOnly)
        {
            var messages = await _mediator.Send(new GetMessagesQuery(CurrentUserId(), propertyId, recipientId, channelId, unreadOnly));
            return Ok(messages);
        }

        /// <summary>Marks a message as read — drives the unread badge in the frontend.</summary>
        [HttpPut("{id:int}/read")]
        [ProducesResponseType(typeof(MessageDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<MessageDto>> MarkRead(int id)
        {
            var result = await _mediator.Send(new MarkMessageReadCommand(id, CurrentUserId()));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        [HttpDelete("{id:int}")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _mediator.Send(new DeleteMessageCommand(id));
            if (result.NotFound)
                return NotFound();
            return NoContent();
        }

        private int CurrentUserId() =>
            int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;

        private string CurrentUserName() =>
            User.FindFirstValue(ClaimTypes.Name) ?? string.Empty;
    }
}
