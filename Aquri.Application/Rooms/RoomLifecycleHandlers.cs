using System;
using System.Threading;
using System.Threading.Tasks;
using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Application.DTOs;
using Aquri.Application.Rooms.Commands;
using Aquri.Domain.Entities;
using AutoMapper;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Rooms.Handlers
{
    /// <summary>Handler for creating a new room.</summary>
    public class CreateRoomHandler : IRequestHandler<CreateRoomCommand, Result<RoomDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly IMapper _mapper;
        private readonly ICurrentUser _currentUser;

        public CreateRoomHandler(IApplicationDbContext context, IMapper mapper, ICurrentUser currentUser)
        {
            _context = context;
            _mapper = mapper;
            _currentUser = currentUser;
        }

        public async Task<Result<RoomDto>> Handle(CreateRoomCommand request, CancellationToken cancellationToken)
        {
            var property = await _context.Properties
                .FirstOrDefaultAsync(p => p.PropertyId == request.PropertyId, cancellationToken);

            if (property == null)
            {
                return Result<RoomDto>.Failure($"Property with ID {request.PropertyId} not found.");
            }

            Room room;
            try
            {
                room = new Room(request.Number, request.PropertyId, request.Type);

                if (!string.IsNullOrWhiteSpace(request.BedType))
                {
                    room.SetBedType(request.BedType);
                }
                if (!string.IsNullOrWhiteSpace(request.View))
                {
                    room.SetView(request.View);
                }
                room.UpdatePrice(request.Price);
                room.UpdateMaxOccupancy(request.MaxOccupancy);
                room.UpdateSize(request.Size ?? 0);
                room.UpdateFloor(request.Floor);
                room.SetDescription(request.Description ?? string.Empty);
                room.AddAmenities(request.Amenities ?? Array.Empty<string>());
            }
            catch (ArgumentException ex)
            {
                return Result<RoomDto>.Failure(ex.Message);
            }

            _context.Rooms.Add(room);
            await _context.SaveChangesAsync(cancellationToken);

            AuditTrail.Write(_context, _currentUser, "create_room", "room", room.Id.ToString(), room.Number);
            await _context.SaveChangesAsync(cancellationToken);

            return Result<RoomDto>.SuccessResult(_mapper.Map<RoomDto>(room));
        }
    }

    /// <summary>Handler for deleting a room.</summary>
    public class DeleteRoomHandler : IRequestHandler<DeleteRoomCommand, Result<bool>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public DeleteRoomHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result<bool>> Handle(DeleteRoomCommand request, CancellationToken cancellationToken)
        {
            var room = await _context.Rooms
                .FindAsync(request.RoomId, cancellationToken);

            if (room == null)
            {
                return Result<bool>.Failure($"Room with ID {request.RoomId} not found.");
            }

            var roomNumber = room.Number;
            _context.Rooms.Remove(room);
            AuditTrail.Write(_context, _currentUser, "delete_room", "room", request.RoomId.ToString(), roomNumber);
            await _context.SaveChangesAsync(cancellationToken);

            return Result<bool>.SuccessResult(true);
        }
    }
}
