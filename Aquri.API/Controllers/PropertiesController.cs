using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Aquri.Application.Properties.Status;
using Aquri.Application.Properties.Queries;
using Aquri.Application.Properties.Commands;
using Aquri.Application.DTOs;
using MediatR;

namespace Aquri.API.Controllers
{
    /// <summary>
    /// Property management endpoints.
    /// Access controlled by role-based authorization.
    /// </summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    [Authorize]
    public class PropertiesController : ControllerBase
    {
        private readonly IMediator _mediator;

        public PropertiesController(IMediator mediator)
        {
            _mediator = mediator;
        }

        /// <summary>
        /// Creates a new property with optional initial rooms.
        /// </summary>
        [HttpPost]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<ActionResult<PropertyDto>> Create(CreatePropertyWithRoomsCommand command)
        {
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                return CreatedAtAction(
                    nameof(GetById),
                    new { id = result.Data!.Id, version = "1.0" },
                    result.Data);
            }

            return BadRequest(result.Error);
        }

        /// <summary>
        /// Gets a property by Id.
        /// </summary>
        [HttpGet("{id}")]
        [Authorize(Roles = "admin,manager,front_desk,housekeeping,maintenance,auditor")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<ActionResult<PropertyDto>> GetById(int id)
        {
            var property = await _mediator.Send(new GetPropertyQuery(id));

            if (property == null)
            {
                return NotFound();
            }

            return Ok(property);
        }

        /// <summary>
        /// Gets all properties.
        /// </summary>
        [HttpGet]
        [Authorize(Roles = "admin,manager,front_desk,housekeeping,maintenance,auditor")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<ActionResult<IEnumerable<PropertyDto>>> GetAll()
        {
            var properties = await _mediator.Send(new GetAllPropertiesQuery());
            return Ok(properties);
        }

        /// <summary>
        /// Updates a property status by Id.
        /// </summary>
        [HttpPut("{id}")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<ActionResult<PropertyDto>> Update(int id, UpdatePropertyStatusCommand command)
        {
            command.Id = id;
            var result = await _mediator.Send(command);

            if (result.NotFound)
            {
                return NotFound();
            }

            if (!result.Success)
            {
                return BadRequest(result.Error);
            }

            return Ok(result.Data);
        }

        /// <summary>
        /// Deletes a property by Id.
        /// </summary>
        [HttpDelete("{id}")]
        [Authorize(Roles = "admin")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _mediator.Send(new DeletePropertyCommand(id));

            if (result.NotFound)
            {
                return NotFound();
            }

            return NoContent();
        }

        /// <summary>
        /// Gets property status by Id.
        /// </summary>
        [HttpGet("{id}/status")]
        [Authorize(Roles = "admin,manager,front_desk,housekeeping,maintenance,auditor")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<ActionResult<object>> GetStatus(int id)
        {
            var property = await _mediator.Send(new GetPropertyQuery(id));

            if (property == null)
            {
                return NotFound();
            }

            return Ok(new { id, status = property.Status });
        }
    }
}
