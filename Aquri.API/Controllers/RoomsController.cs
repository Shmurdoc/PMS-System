using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Aquri.Application.Rooms.Commands;
using Aquri.Application.Rooms.Queries;
using Aquri.Application.DTOs;
using MediatR;

namespace Aquri.API.Controllers
{
    /// <summary>Room management endpoints. Access controlled by role-based authorization.</summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    [Authorize]
    public class RoomsController : ControllerBase
    {
        private readonly IMediator _mediator;

        public RoomsController(IMediator mediator)
        {
            _mediator = mediator;
        }

        [HttpPost]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<ActionResult<RoomDto>> Create(CreateRoomCommand command)
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

        [HttpGet("{id}")]
        [Authorize(Roles = "admin,manager,front_desk,housekeeping,maintenance,auditor")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<ActionResult<RoomDto>> GetById(int id)
        {
            var room = await _mediator.Send(new GetRoomQuery(id));

            if (room == null)
            {
                return NotFound();
            }

            return Ok(room);
        }

        [HttpGet("property/{propertyId}")]
        [Authorize(Roles = "admin,manager,front_desk,housekeeping,maintenance,auditor")]
        [ProducesResponseType(typeof(List<RoomDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<ActionResult<List<RoomDto>>> GetByPropertyId(int propertyId, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            var rows = await _mediator.Send(new GetRoomsByPropertyQuery(propertyId) { Page = page, PageSize = pageSize });
            Response.Headers["X-Total-Count"] = rows.TotalCount.ToString();
            Response.Headers["X-Page"] = rows.Page.ToString();
            Response.Headers["X-Page-Size"] = rows.PageSize.ToString();
            return Ok(rows.Data);
        }

        [HttpPut("status")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<ActionResult<RoomDto>> UpdateStatus(UpdateRoomStatusCommand command)
        {
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                return Ok(result.Data);
            }

            return BadRequest(result.Error);
        }

        [HttpPut("price")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<ActionResult<RoomDto>> UpdatePrice(UpdateRoomPriceCommand command)
        {
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                return Ok(result.Data);
            }

            return BadRequest(result.Error);
        }

        [HttpPut("max-occupancy")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<ActionResult<RoomDto>> UpdateMaxOccupancy(UpdateRoomMaxOccupancyCommand command)
        {
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                return Ok(result.Data);
            }

            return BadRequest(result.Error);
        }

        [HttpPut("amenities")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<ActionResult<RoomDto>> UpdateAmenities(UpdateRoomAmenitiesCommand command)
        {
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                return Ok(result.Data);
            }

            return BadRequest(result.Error);
        }

        [HttpPut("view")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<ActionResult<RoomDto>> UpdateView(UpdateRoomViewCommand command)
        {
            var result = await _mediator.Send(command);

            if (result.Success)
            {
                return Ok(result.Data);
            }

            return BadRequest(result.Error);
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "admin")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _mediator.Send(new DeleteRoomCommand { RoomId = id });

            if (!result.Success)
            {
                return NotFound(result.Error);
            }

            return NoContent();
        }
    }
}
