using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Application.DTOs;
using Aquri.Domain.Entities;
using AutoMapper;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Properties.Commands
{
    /// <summary>
    /// Creates a new Property and persists it via the DbContext (the unit of work).
    /// </summary>
    public class CreatePropertyHandler : IRequestHandler<CreatePropertyCommand, Result<PropertyDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly IMapper _mapper;

        public CreatePropertyHandler(IApplicationDbContext context, IMapper mapper)
        {
            _context = context;
            _mapper = mapper;
        }

        public async Task<Result<PropertyDto>> Handle(CreatePropertyCommand request, CancellationToken cancellationToken)
        {
            var exists = await _context.Properties
                .AnyAsync(p => p.PropertyId == request.PropertyId, cancellationToken);

            if (exists)
            {
                return Result<PropertyDto>.Failure(
                    $"Property with tenant id {request.PropertyId} already exists.");
            }

            Property property;
            try
            {
                property = new Property(request.Name, request.PropertyId);
            }
            catch (ArgumentException ex)
            {
                return Result<PropertyDto>.Failure(ex.Message);
            }

            _context.Properties.Add(property);
            await _context.SaveChangesAsync(cancellationToken);

            return Result<PropertyDto>.SuccessResult(_mapper.Map<PropertyDto>(property));
        }
    }
}
