using System;
using Aquri.Application.ApiKeys;
using Aquri.Application.DTOs;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Aquri.API.Controllers
{
    /// <summary>API key management — create and list programmatic access keys. The raw key is returned once at creation.</summary>
    [ApiVersion("1.0")]
    [ApiController]
    [Route("api/v{version:apiVersion}/[controller]")]
    [Authorize(Roles = "admin,manager")]
    public class ApiKeysController : ControllerBase
    {
        private readonly IMediator _mediator;

        public ApiKeysController(IMediator mediator) => _mediator = mediator;

        /// <summary>Creates a new API key. Returns the raw key once — store it securely.</summary>
        [HttpPost]
        [ProducesResponseType(typeof(ApiKeyDto), StatusCodes.Status201Created)]
        [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<ApiKeyDto>> Create([FromBody] CreateApiKeyCommand command)
        {
            var result = await _mediator.Send(command);
            if (!result.Success)
                return BadRequest(result.Error);
            return CreatedAtAction(nameof(Create), new { version = "1.0" }, result.Data);
        }
    }
}
