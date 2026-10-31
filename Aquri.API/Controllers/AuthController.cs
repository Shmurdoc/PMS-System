using Aquri.Application.Auth;
using Aquri.Application.Common.Interfaces;
using Aquri.Application.DTOs;
using Aquri.Application.Users;
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
        private readonly ICurrentUser _currentUser;

        public AuthController(IMediator mediator, ICurrentUser currentUser)
        {
            _mediator = mediator;
            _currentUser = currentUser;
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
            var userId = _currentUser.UserId;

            if (userId == 0)
                return Unauthorized();

            var result = await _mediator.Send(new GetCurrentUserQuery(userId));

            if (!result.Success)
                return NotFound(new { error = result.Error ?? "User not found." });

            return Ok(result.Data);
        }
    }
}
