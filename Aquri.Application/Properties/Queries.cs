using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Application.DTOs;
using AutoMapper;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Properties.Queries
{
    /// <summary>Query to get a property by its primary key Id.</summary>
    public class GetPropertyQuery : IRequest<PropertyDto?>
    {
        public int Id { get; set; }

        public GetPropertyQuery(int id)
        {
            Id = id;
        }
    }

    /// <summary>Handler for getting a property by Id.</summary>
    public class GetPropertyHandler : IRequestHandler<GetPropertyQuery, PropertyDto?>
    {
        private readonly IApplicationDbContext _context;
        private readonly IMapper _mapper;

        public GetPropertyHandler(IApplicationDbContext context, IMapper mapper)
        {
            _context = context;
            _mapper = mapper;
        }

        public async Task<PropertyDto?> Handle(GetPropertyQuery request, CancellationToken cancellationToken)
        {
            var property = await _context.Properties
                .FindAsync(request.Id, cancellationToken);

            return property == null ? null : _mapper.Map<PropertyDto>(property);
        }
    }

    /// <summary>Query to get all properties.</summary>
    public class GetAllPropertiesQuery : IRequest<List<PropertyDto>>
    {
    }

    /// <summary>Handler for getting all properties.</summary>
    public class GetAllPropertiesHandler : IRequestHandler<GetAllPropertiesQuery, List<PropertyDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly IMapper _mapper;

        public GetAllPropertiesHandler(IApplicationDbContext context, IMapper mapper)
        {
            _context = context;
            _mapper = mapper;
        }

        public async Task<List<PropertyDto>> Handle(GetAllPropertiesQuery request, CancellationToken cancellationToken)
        {
            var properties = await _context.Properties
                .ToListAsync(cancellationToken);

            return _mapper.Map<List<PropertyDto>>(properties);
        }
    }

    /// <summary>Command to delete a property by primary key Id.</summary>
    public class DeletePropertyCommand : IRequest<Result<bool>>
    {
        public int Id { get; set; }

        public DeletePropertyCommand(int id)
        {
            Id = id;
        }
    }

    /// <summary>Handler for deleting a property.</summary>
    public class DeletePropertyHandler : IRequestHandler<DeletePropertyCommand, Result<bool>>
    {
        private readonly IApplicationDbContext _context;

        public DeletePropertyHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<Result<bool>> Handle(DeletePropertyCommand request, CancellationToken cancellationToken)
        {
            var property = await _context.Properties
                .FindAsync(request.Id, cancellationToken);

            if (property == null)
            {
                return Result<bool>.NotFoundResult();
            }

            _context.Properties.Remove(property);
            await _context.SaveChangesAsync(cancellationToken);

            return Result<bool>.SuccessResult(true);
        }
    }
}
