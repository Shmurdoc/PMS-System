using System.Threading;
using System.Threading.Tasks;
using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Application.DTOs;
using Aquri.Application.Rooms.Commands;
using Aquri.Domain.Enums;
using Aquri.Domain.Exceptions;
using AutoMapper;
using MediatR;

namespace Aquri.Application.Rooms.Handlers
{
    /// <summary>
    /// Handler for updating room status.
    /// </summary>
    public class UpdateRoomStatusHandler : IRequestHandler<UpdateRoomStatusCommand, Result<RoomDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly IMapper _mapper;

        public UpdateRoomStatusHandler(IApplicationDbContext context, IMapper mapper)
        {
            _context = context;
            _mapper = mapper;
        }

        public async Task<Result<RoomDto>> Handle(UpdateRoomStatusCommand request, CancellationToken cancellationToken)
        {
            var room = await _context.Rooms
                .FindAsync(request.RoomId, cancellationToken);

            if (room == null)
            {
                return Result<RoomDto>.Failure($"Room with ID {request.RoomId} not found.");
            }

            if (!RoomStatusExtensions.TryParseWire(request.Status, out var newStatus))
                return Result<RoomDto>.Failure($"Unknown room status '{request.Status}'.");

            try
            {
                room.ChangeStatus(newStatus);
            }
            catch (DomainException ex)
            {
                return Result<RoomDto>.Failure(ex.Message);
            }

            await _context.SaveChangesAsync(cancellationToken);

            return Result<RoomDto>.SuccessResult(_mapper.Map<RoomDto>(room));
        }
    }

    /// <summary>
    /// Handler for updating room price.
    /// </summary>
    public class UpdateRoomPriceHandler : IRequestHandler<UpdateRoomPriceCommand, Result<RoomDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly IMapper _mapper;

        public UpdateRoomPriceHandler(IApplicationDbContext context, IMapper mapper)
        {
            _context = context;
            _mapper = mapper;
        }

        public async Task<Result<RoomDto>> Handle(UpdateRoomPriceCommand request, CancellationToken cancellationToken)
        {
            var room = await _context.Rooms
                .FindAsync(request.RoomId, cancellationToken);

            if (room == null)
            {
                return Result<RoomDto>.Failure($"Room with ID {request.RoomId} not found.");
            }

            try
            {
                room.UpdatePrice(request.Price);
            }
            catch (ArgumentException ex)
            {
                return Result<RoomDto>.Failure(ex.Message);
            }

            await _context.SaveChangesAsync(cancellationToken);

            return Result<RoomDto>.SuccessResult(_mapper.Map<RoomDto>(room));
        }
    }

    /// <summary>
    /// Handler for updating room max occupancy.
    /// </summary>
    public class UpdateRoomMaxOccupancyHandler : IRequestHandler<UpdateRoomMaxOccupancyCommand, Result<RoomDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly IMapper _mapper;

        public UpdateRoomMaxOccupancyHandler(IApplicationDbContext context, IMapper mapper)
        {
            _context = context;
            _mapper = mapper;
        }

        public async Task<Result<RoomDto>> Handle(UpdateRoomMaxOccupancyCommand request, CancellationToken cancellationToken)
        {
            var room = await _context.Rooms
                .FindAsync(request.RoomId, cancellationToken);

            if (room == null)
            {
                return Result<RoomDto>.Failure($"Room with ID {request.RoomId} not found.");
            }

            try
            {
                room.UpdateMaxOccupancy(request.MaxOccupancy);
            }
            catch (ArgumentException ex)
            {
                return Result<RoomDto>.Failure(ex.Message);
            }

            await _context.SaveChangesAsync(cancellationToken);

            return Result<RoomDto>.SuccessResult(_mapper.Map<RoomDto>(room));
        }
    }

    /// <summary>
    /// Handler for updating room amenities.
    /// </summary>
    public class UpdateRoomAmenitiesHandler : IRequestHandler<UpdateRoomAmenitiesCommand, Result<RoomDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly IMapper _mapper;

        public UpdateRoomAmenitiesHandler(IApplicationDbContext context, IMapper mapper)
        {
            _context = context;
            _mapper = mapper;
        }

        public async Task<Result<RoomDto>> Handle(UpdateRoomAmenitiesCommand request, CancellationToken cancellationToken)
        {
            // Validate before touching the domain model: Room.Add/RemoveAmenity throw
            // ArgumentException on empty input, which would escape the Result pipeline
            // and surface as an enveloped 500 instead of a 400 VALIDATION failure.
            if (string.IsNullOrWhiteSpace(request.Amenity))
            {
                return Result<RoomDto>.Failure("Amenity cannot be null or empty.");
            }

            var room = await _context.Rooms
                .FindAsync(request.RoomId, cancellationToken);

            if (room == null)
            {
                return Result<RoomDto>.Failure($"Room with ID {request.RoomId} not found.");
            }

            if (request.Action == "add")
            {
                room.AddAmenity(request.Amenity);
            }
            else if (request.Action == "remove")
            {
                room.RemoveAmenity(request.Amenity);
            }
            else
            {
                return Result<RoomDto>.Failure("Action must be 'add' or 'remove'.");
            }

            await _context.SaveChangesAsync(cancellationToken);

            return Result<RoomDto>.SuccessResult(_mapper.Map<RoomDto>(room));
        }
    }

    /// <summary>
    /// Handler for updating room view.
    /// </summary>
    public class UpdateRoomViewHandler : IRequestHandler<UpdateRoomViewCommand, Result<RoomDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly IMapper _mapper;

        public UpdateRoomViewHandler(IApplicationDbContext context, IMapper mapper)
        {
            _context = context;
            _mapper = mapper;
        }

        public async Task<Result<RoomDto>> Handle(UpdateRoomViewCommand request, CancellationToken cancellationToken)
        {
            var room = await _context.Rooms
                .FindAsync(request.RoomId, cancellationToken);

            if (room == null)
            {
                return Result<RoomDto>.Failure($"Room with ID {request.RoomId} not found.");
            }

            try
            {
                room.SetView(request.View);
            }
            catch (ArgumentException ex)
            {
                return Result<RoomDto>.Failure(ex.Message);
            }

            await _context.SaveChangesAsync(cancellationToken);

            return Result<RoomDto>.SuccessResult(_mapper.Map<RoomDto>(room));
        }
    }
}
