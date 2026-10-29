using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Application.DTOs;
using Aquri.Domain.Entities;
using AutoMapper;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Rooms.Queries
{
    /// <summary>Query to get a room by its ID.</summary>
    public class GetRoomQuery : IRequest<RoomDto?>
    {
        public int Id { get; set; }

        public GetRoomQuery(int id)
        {
            Id = id;
        }
    }

    /// <summary>Handler for getting a room by ID.</summary>
    public class GetRoomHandler : IRequestHandler<GetRoomQuery, RoomDto?>
    {
        private readonly IApplicationDbContext _context;
        private readonly IMapper _mapper;
        private readonly ICurrentUser _currentUser;

        public GetRoomHandler(IApplicationDbContext context, IMapper mapper, ICurrentUser currentUser)
        {
            _context = context;
            _mapper = mapper;
            _currentUser = currentUser;
        }

        public async Task<RoomDto?> Handle(GetRoomQuery request, CancellationToken cancellationToken)
        {
            var query = _context.Rooms.AsNoTracking();

            // Defense in depth: a scoped caller may only read their own property's
            // rooms, so probing another property's room Id returns null (404).
            if (_currentUser.UserRole != AppRoles.Admin && _currentUser.PropertyId is int scope)
                query = query.Where(r => r.PropertyId == scope);

            var room = await query
                .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);

            return room == null ? null : _mapper.Map<RoomDto>(room);
        }
    }

    /// <summary>Query to get all rooms for a specific property.</summary>
    public class GetRoomsByPropertyQuery : IRequest<PagedRows<RoomDto>>
    {
        public int PropertyId { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 50;

        public GetRoomsByPropertyQuery(int propertyId)
        {
            PropertyId = propertyId;
        }
    }

    /// <summary>Handler for getting all rooms for a property.</summary>
    public class GetRoomsByPropertyHandler : IRequestHandler<GetRoomsByPropertyQuery, PagedRows<RoomDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly IMapper _mapper;
        private readonly ICurrentUser _currentUser;

        public GetRoomsByPropertyHandler(IApplicationDbContext context, IMapper mapper, ICurrentUser currentUser)
        {
            _context = context;
            _mapper = mapper;
            _currentUser = currentUser;
        }

        public async Task<PagedRows<RoomDto>> Handle(GetRoomsByPropertyQuery request, CancellationToken cancellationToken)
        {
            var page = Math.Clamp(request.Page, 1, int.MaxValue);
            var pageSize = Math.Clamp(request.PageSize, 1, 200);

            var query = _context.Rooms.AsNoTracking().Where(r => r.PropertyId == request.PropertyId);

            // Defense in depth: a scoped caller may only read their own property's
            // rooms, even if they supply a different PropertyId in the request.
            if (_currentUser.UserRole != AppRoles.Admin && _currentUser.PropertyId is int scope)
                query = query.Where(r => r.PropertyId == scope);

            var totalCount = await query.CountAsync(cancellationToken);
            var rooms = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(cancellationToken);

            return new PagedRows<RoomDto>
            {
                Data = _mapper.Map<List<RoomDto>>(rooms),
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            };
        }
    }
}
