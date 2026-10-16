using Aquri.Application.Users;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Aquri.API.Controllers
{
    /// <summary>Staff account administration. Reads are available to admin and manager; every write (create, update, delete) is admin only. The password hash never appears in any response — <see cref="UserDto"/> does not project it.</summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly IMediator _mediator;

        public UsersController(IMediator mediator) => _mediator = mediator;

        [HttpGet]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(typeof(List<UserDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<List<UserDto>>> List([FromQuery] string? search)
        {
            var users = await _mediator.Send(new GetUsersQuery(search));
            return Ok(users);
        }

        [HttpGet("{id:int}")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<UserDto>> Get(int id)
        {
            var result = await _mediator.Send(new GetUserQuery(id));
            if (result.NotFound)
                return NotFound();
            return Ok(result.Data);
        }

        /// <summary>Creates a staff account with a hashed password (admin only).</summary>
        [HttpPost]
        [Authorize(Roles = "admin")]
        [ProducesResponseType(typeof(UserDto), StatusCodes.Status201Created)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status409Conflict)]
        public async Task<ActionResult<UserDto>> Create([FromBody] CreateUserCommand command)
        {
            var result = await _mediator.Send(command);
            if (result.Conflict)
                return Conflict(result.Error);
            if (!result.Success)
                return BadRequest(result.Error);

            return CreatedAtAction(nameof(Get), new { id = result.Data!.Id, version = "1.0" }, result.Data);
        }

        /// <summary>Updates a profile and optionally role/password (admin only). Email is the login identity and cannot be changed.</summary>
        [HttpPut("{id:int}")]
        [Authorize(Roles = "admin")]
        [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<UserDto>> Update(int id, [FromBody] UpdateUserCommand command)
        {
            var result = await _mediator.Send(command with { Id = id });
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Deletes an account (admin only). Conflicts (409) protect the signed-in account, the last admin, and accounts with dependent records.</summary>
        [HttpDelete("{id:int}")]
        [Authorize(Roles = "admin")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status409Conflict)]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _mediator.Send(new DeleteUserCommand(id, CurrentUserId()));
            if (result.NotFound)
                return NotFound();
            if (result.Conflict)
                return Conflict(result.Error);
            return NoContent();
        }

        private int CurrentUserId() =>
            int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;
    }
}
