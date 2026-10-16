using System.Security.Claims;
using Aquri.Application.Auth;
using Aquri.Application.DTOs;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Aquri.API.Controllers
{
    /// <summary>Authentication endpoints: login and current-user profile. Login is anonymous; /me requires a valid Bearer token.</summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IMediator _mediator;

        public AuthController(IMediator mediator)
        {
            _mediator = mediator;
        }

        /// <summary>Authenticates email + password and returns a signed JWT.</summary>
        [HttpPost("login")]
        [AllowAnonymous]
        [EnableRateLimiting("auth")]
        [ProducesResponseType(typeof(LoginResponseDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<ActionResult<LoginResponseDto>> Login([FromBody] LoginRequestDto request)
        {
            if (request is null)
                return BadRequest(new { error = "Request body is required." });

            var result = await _mediator.Send(new LoginCommand(request.Email, request.Password));

            if (!result.Success)
                return Unauthorized(new { error = result.Error });

            return Ok(result.Data);
        }

        /// <summary>Returns the profile for the authenticated user (from the JWT).</summary>
        [HttpGet("me")]
        [Authorize]
        [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<UserDto>> GetCurrentUser()
        {
            var idClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (!int.TryParse(idClaim, out var userId))
                return Unauthorized();

            var result = await _mediator.Send(new GetCurrentUserQuery(userId));

            if (!result.Success)
                return NotFound(new { error = result.Error ?? "User not found." });

            return Ok(result.Data);
        }
    }
}
