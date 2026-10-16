using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Aquri.Application.Common.Interfaces;
using Aquri.Application.DTOs;
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

        public GetRoomHandler(IApplicationDbContext context, IMapper mapper)
        {
            _context = context;
            _mapper = mapper;
        }

        public async Task<RoomDto?> Handle(GetRoomQuery request, CancellationToken cancellationToken)
        {
            var room = await _context.Rooms
                .FindAsync(request.Id, cancellationToken);

            return room == null ? null : _mapper.Map<RoomDto>(room);
        }
    }

    /// <summary>Query to get all rooms for a specific property.</summary>
    public class GetRoomsByPropertyQuery : IRequest<List<RoomDto>>
    {
        public int PropertyId { get; set; }

        public GetRoomsByPropertyQuery(int propertyId)
        {
            PropertyId = propertyId;
        }
    }

    /// <summary>Handler for getting all rooms for a property.</summary>
    public class GetRoomsByPropertyHandler : IRequestHandler<GetRoomsByPropertyQuery, List<RoomDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly IMapper _mapper;

        public GetRoomsByPropertyHandler(IApplicationDbContext context, IMapper mapper)
        {
            _context = context;
            _mapper = mapper;
        }

        public async Task<List<RoomDto>> Handle(GetRoomsByPropertyQuery request, CancellationToken cancellationToken)
        {
            var rooms = await _context.Rooms
                .Where(r => r.PropertyId == request.PropertyId)
                .ToListAsync(cancellationToken);

            return _mapper.Map<List<RoomDto>>(rooms);
        }
    }
}
