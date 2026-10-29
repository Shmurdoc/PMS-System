using Aquri.Application.Common.Interfaces;
using Aquri.Application.Users;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Aquri.API.Controllers
{
    /// <summary>Staff account administration. The roster list is open to every signed-in role (staff messaging needs to see colleagues); single-account reads are admin and manager; every write (create, update, delete) is admin only. The password hash never appears in any response — <see cref="UserDto"/> does not project it.</summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly IMediator _mediator;
        private readonly ICurrentUser _currentUser;

        public UsersController(IMediator mediator, ICurrentUser currentUser)
        {
            _mediator = mediator;
            _currentUser = currentUser;
        }

        [HttpGet]
        [ProducesResponseType(typeof(List<UserDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<List<UserDto>>> List([FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            var rows = await _mediator.Send(new GetUsersQuery(search, page, pageSize));
            Response.Headers["X-Total-Count"] = rows.TotalCount.ToString();
            Response.Headers["X-Page"] = rows.Page.ToString();
            Response.Headers["X-Page-Size"] = rows.PageSize.ToString();
            return Ok(rows.Data);
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

        /// <summary>Creates a staff account with a hashed password. Admin can create at any property; a manager can only create at their own property.</summary>
        [HttpPost]
        [Authorize(Roles = "admin,manager")]
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

        /// <summary>Updates a profile and optionally role/password. Admin can update any account; a manager can only update accounts at their own property.</summary>
        [HttpPut("{id:int}")]
        [Authorize(Roles = "admin,manager")]
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

        /// <summary>Deletes an account. Admin can delete any account; a manager can only delete accounts at their own property. Conflicts (409) protect the signed-in account, the last admin, and accounts with dependent records.</summary>
        [HttpDelete("{id:int}")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status409Conflict)]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _mediator.Send(new DeleteUserCommand(id, _currentUser.UserId));
            if (result.NotFound)
                return NotFound();
            if (result.Conflict)
                return Conflict(result.Error);
            return NoContent();
        }
    }
}
