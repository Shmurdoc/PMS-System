using System;
using System.Threading;
using System.Threading.Tasks;
using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Application.DTOs;
using Aquri.Domain.Entities;
using AutoMapper;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Properties.Commands
{
    public class CreatePropertyWithRoomsHandler : IRequestHandler<CreatePropertyWithRoomsCommand, Result<PropertyDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly IMapper _mapper;
        private readonly ICurrentUser _currentUser;

        public CreatePropertyWithRoomsHandler(IApplicationDbContext context, IMapper mapper, ICurrentUser currentUser)
        {
            _context = context;
            _mapper = mapper;
            _currentUser = currentUser;
        }

        public async Task<Result<PropertyDto>> Handle(CreatePropertyWithRoomsCommand request, CancellationToken cancellationToken)
        {
            var existingProperty = await _context.Properties
                .FirstOrDefaultAsync(p => p.PropertyId == request.PropertyId, cancellationToken);

            if (existingProperty != null)
            {
                return Result<PropertyDto>.Failure($"Property with ID {request.PropertyId} already exists.");
            }

            Property property;
            try
            {
                property = new Property(request.Name, request.PropertyId);
                property.UpdateDetails(
                    request.Description,
                    request.Address,
                    request.Manager,
                    request.Rating,
                    request.Phone,
                    request.Email);
            }
            catch (ArgumentException ex)
            {
                return Result<PropertyDto>.Failure(ex.Message);
            }

            _context.Properties.Add(property);

            AuditTrail.Write(_context, _currentUser, "create_property", "property", request.PropertyId.ToString(), request.Name);

            if (request.InitialRooms != null && request.InitialRooms.Count > 0)
            {
                foreach (var roomDto in request.InitialRooms)
                {
                    Room room;
                    try
                    {
                        room = new Room(roomDto.Number, request.PropertyId, roomDto.Type);

                        if (!string.IsNullOrWhiteSpace(roomDto.BedType))
                        {
                            room.SetBedType(roomDto.BedType);
                        }
                        if (!string.IsNullOrWhiteSpace(roomDto.View))
                        {
                            room.SetView(roomDto.View);
                        }
                        room.UpdatePrice(roomDto.Price);
                        room.UpdateMaxOccupancy(roomDto.MaxOccupancy);
                        room.UpdateSize(roomDto.Size ?? 0);
                        room.UpdateFloor(roomDto.Floor);
                        room.SetDescription(roomDto.Description ?? string.Empty);
                        room.AddAmenities(roomDto.Amenities ?? Array.Empty<string>());
                    }
                    catch (ArgumentException ex)
                    {
                        return Result<PropertyDto>.Failure($"Invalid room '{roomDto.Number}': {ex.Message}");
                    }

                    _context.Rooms.Add(room);
                }
            }

            await _context.SaveChangesAsync(cancellationToken);

            return Result<PropertyDto>.SuccessResult(_mapper.Map<PropertyDto>(property));
        }
    }
}
