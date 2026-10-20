using System.Threading;
using System.Threading.Tasks;
using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Application.DTOs;
using Aquri.Application.Rooms.Commands;
using Aquri.Domain.Entities;
using Aquri.Domain.Enums;
using Aquri.Domain.Exceptions;
using AutoMapper;
using MediatR;

namespace Aquri.Application.Rooms.Handlers
{
    /// <summary>Shared plumbing for the per-field room update handlers: load the room, run the mutation, persist, map. Subclasses supply the command's room id and the mutation itself. Domain-rule failures (ArgumentException from argument checks, DomainException from illegal state transitions) come back as Result failures rather than escaping the Result pipeline as enveloped 500s. The amenities handler intentionally does not extend this — its amenity validation must run before the room load, and its add/remove branching has no try/catch equivalent.</summary>
    public abstract class UpdateRoomHandlerBase<TCommand> : IRequestHandler<TCommand, Result<RoomDto>>
        where TCommand : IRequest<Result<RoomDto>>
    {
        protected UpdateRoomHandlerBase(IApplicationDbContext context, IMapper mapper)
        {
            Context = context;
            Mapper = mapper;
        }

        protected IApplicationDbContext Context { get; }

        protected IMapper Mapper { get; }

        protected abstract int RoomId(TCommand request);

        /// <summary>Applies the mutation; returns a failure message, or null on success.</summary>
        protected abstract string? Mutate(Room room, TCommand request);

        public async Task<Result<RoomDto>> Handle(TCommand request, CancellationToken cancellationToken)
        {
            var roomId = RoomId(request);
            var room = await Context.Rooms.FindAsync(roomId, cancellationToken);

            if (room == null)
            {
                return Result<RoomDto>.Failure($"Room with ID {roomId} not found.");
            }

            try
            {
                var failure = Mutate(room, request);
                if (failure is not null)
                    return Result<RoomDto>.Failure(failure);
            }
            catch (ArgumentException ex)
            {
                return Result<RoomDto>.Failure(ex.Message);
            }
            catch (DomainException ex)
            {
                return Result<RoomDto>.Failure(ex.Message);
            }

            await Context.SaveChangesAsync(cancellationToken);

            return Result<RoomDto>.SuccessResult(Mapper.Map<RoomDto>(room));
        }
    }

    /// <summary>Handler for updating room status.</summary>
    public class UpdateRoomStatusHandler : UpdateRoomHandlerBase<UpdateRoomStatusCommand>
    {
        public UpdateRoomStatusHandler(IApplicationDbContext context, IMapper mapper)
            : base(context, mapper)
        {
        }

        protected override int RoomId(UpdateRoomStatusCommand request) => request.RoomId;

        protected override string? Mutate(Room room, UpdateRoomStatusCommand request)
        {
            if (!RoomStatusExtensions.TryParseWire(request.Status, out var newStatus))
                return $"Unknown room status '{request.Status}'.";

            room.ChangeStatus(newStatus);
            return null;
        }
    }

    /// <summary>Handler for updating room price.</summary>
    public class UpdateRoomPriceHandler : UpdateRoomHandlerBase<UpdateRoomPriceCommand>
    {
        public UpdateRoomPriceHandler(IApplicationDbContext context, IMapper mapper)
            : base(context, mapper)
        {
        }

        protected override int RoomId(UpdateRoomPriceCommand request) => request.RoomId;

        protected override string? Mutate(Room room, UpdateRoomPriceCommand request)
        {
            room.UpdatePrice(request.Price);
            return null;
        }
    }

    /// <summary>Handler for updating room max occupancy.</summary>
    public class UpdateRoomMaxOccupancyHandler : UpdateRoomHandlerBase<UpdateRoomMaxOccupancyCommand>
    {
        public UpdateRoomMaxOccupancyHandler(IApplicationDbContext context, IMapper mapper)
            : base(context, mapper)
        {
        }

        protected override int RoomId(UpdateRoomMaxOccupancyCommand request) => request.RoomId;

        protected override string? Mutate(Room room, UpdateRoomMaxOccupancyCommand request)
        {
            room.UpdateMaxOccupancy(request.MaxOccupancy);
            return null;
        }
    }

    /// <summary>Handler for updating room amenities.</summary>
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

    /// <summary>Handler for updating room view.</summary>
    public class UpdateRoomViewHandler : UpdateRoomHandlerBase<UpdateRoomViewCommand>
    {
        public UpdateRoomViewHandler(IApplicationDbContext context, IMapper mapper)
            : base(context, mapper)
        {
        }

        protected override int RoomId(UpdateRoomViewCommand request) => request.RoomId;

        protected override string? Mutate(Room room, UpdateRoomViewCommand request)
        {
            room.SetView(request.View);
            return null;
        }
    }
}
