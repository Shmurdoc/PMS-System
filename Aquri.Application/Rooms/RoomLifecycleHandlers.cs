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

namespace Aquri.Application.Rooms.Handlers
{
    /// <summary>Handler for creating a new room.</summary>
    public class CreateRoomHandler : IRequestHandler<CreateRoomCommand, Result<RoomDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly IMapper _mapper;

        public CreateRoomHandler(IApplicationDbContext context, IMapper mapper)
        {
            _context = context;
            _mapper = mapper;
        }

        public async Task<Result<RoomDto>> Handle(CreateRoomCommand request, CancellationToken cancellationToken)
        {
            var property = await _context.Properties
                .FindAsync(request.PropertyId, cancellationToken);

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

            return Result<RoomDto>.SuccessResult(_mapper.Map<RoomDto>(room));
        }
    }

    /// <summary>Handler for renaming a room (updates the room number).</summary>
    public class RenameRoomHandler : IRequestHandler<RenameRoomCommand, Result<RoomDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly IMapper _mapper;

        public RenameRoomHandler(IApplicationDbContext context, IMapper mapper)
        {
            _context = context;
            _mapper = mapper;
        }

        public async Task<Result<RoomDto>> Handle(RenameRoomCommand request, CancellationToken cancellationToken)
        {
            var room = await _context.Rooms
                .FindAsync(request.RoomId, cancellationToken);

            if (room == null)
            {
                return Result<RoomDto>.Failure($"Room with ID {request.RoomId} not found.");
            }

            if (string.IsNullOrWhiteSpace(request.NewNumber))
            {
                return Result<RoomDto>.Failure("Room number cannot be empty.");
            }

            room.Rename(request.NewNumber);
            await _context.SaveChangesAsync(cancellationToken);

            return Result<RoomDto>.SuccessResult(_mapper.Map<RoomDto>(room));
        }
    }

    /// <summary>Handler for deleting a room.</summary>
    public class DeleteRoomHandler : IRequestHandler<DeleteRoomCommand, Result<bool>>
    {
        private readonly IApplicationDbContext _context;

        public DeleteRoomHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<Result<bool>> Handle(DeleteRoomCommand request, CancellationToken cancellationToken)
        {
            var room = await _context.Rooms
                .FindAsync(request.RoomId, cancellationToken);

            if (room == null)
            {
                return Result<bool>.Failure($"Room with ID {request.RoomId} not found.");
            }

            _context.Rooms.Remove(room);
            await _context.SaveChangesAsync(cancellationToken);

            return Result<bool>.SuccessResult(true);
        }
    }
}
