using System.Security.Claims;
using Aquri.Application.Integrations;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Aquri.API.Controllers
{
    /// <summary>Third-party integrations — configuration and sync state.</summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    [Authorize]
    public class IntegrationsController : ControllerBase
    {
        private readonly IMediator _mediator;

        public IntegrationsController(IMediator mediator) => _mediator = mediator;

        /// <summary>Wires up a new integration.</summary>
        [HttpPost]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(typeof(IntegrationDto), StatusCodes.Status201Created)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<IntegrationDto>> Create([FromBody] CreateIntegrationRequest request)
        {
            var result = await _mediator.Send(request.ToCommand(CurrentUserName()));
            if (!result.Success)
                return BadRequest(result.Error);

            return CreatedAtAction(nameof(Get), new { id = result.Data!.Id, version = "1.0" }, result.Data);
        }

        /// <summary>Fetches one integration by id.</summary>
        [HttpGet("{id:int}")]
        [ProducesResponseType(typeof(IntegrationDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<IntegrationDto>> Get(int id)
        {
            var result = await _mediator.Send(new GetIntegrationQuery(id));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Lists integrations, optionally filtered by property, category, and status.</summary>
        [HttpGet]
        [ProducesResponseType(typeof(List<IntegrationDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<List<IntegrationDto>>> List(
            [FromQuery] int? propertyId, [FromQuery] string? category, [FromQuery] string? status)
        {
            var integrations = await _mediator.Send(new GetIntegrationsQuery(propertyId, category, status));
            return Ok(integrations);
        }

        /// <summary>Edits an integration's details.</summary>
        [HttpPut("{id:int}")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(typeof(IntegrationDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<IntegrationDto>> Update(int id, [FromBody] UpdateIntegrationCommand command)
        {
            var result = await _mediator.Send(command with { Id = id });
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Records a successful sync — stamps LastSync and flips status to connected.</summary>
        [HttpPost("{id:int}/sync")]
        [Authorize(Roles = "admin,manager")]
        [ProducesResponseType(typeof(IntegrationDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<IntegrationDto>> Sync(int id)
        {
            var result = await _mediator.Send(new SyncIntegrationCommand(id));
            if (result.NotFound)
                return NotFound();
            if (!result.Success)
                return BadRequest(result.Error);
            return Ok(result.Data);
        }

        /// <summary>Deletes an integration.</summary>
        [HttpDelete("{id:int}")]
        [Authorize(Roles = "admin")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _mediator.Send(new DeleteIntegrationCommand(id));
            if (result.NotFound)
                return NotFound();
            return NoContent();
        }

        private string CurrentUserName() =>
            User.FindFirstValue(ClaimTypes.Name) ?? string.Empty;
    }

    /// <summary>Wire shape for integration creation; the configured-by name comes from the JWT.</summary>
    public record CreateIntegrationRequest(
        int PropertyId,
        string Name,
        string Category,
        string? Description,
        string? Icon,
        string? ApiKey,
        string? WebhookUrl)
    {
        public CreateIntegrationCommand ToCommand(string configuredBy) =>
            new(PropertyId, Name, Category, Description, Icon, ApiKey, WebhookUrl, configuredBy);
    }
}
