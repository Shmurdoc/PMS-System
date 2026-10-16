using Aquri.Application.AiChat;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Aquri.API.Controllers
{
    /// <summary>Answers questions about the property — deterministic stats first, LLM behind a key.</summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    [Authorize(Roles = "admin,manager")]
    public class ChatController : ControllerBase
    {
        private readonly IMediator _mediator;

        public ChatController(IMediator mediator) => _mediator = mediator;

        [HttpPost]
        [ProducesResponseType(typeof(ChatResponse), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<ChatResponse>> Send([FromBody] SendChatCommand command)
        {
            var result = await _mediator.Send(command);
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }
    }
}
