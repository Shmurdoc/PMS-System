using System;
using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using Aquri.Domain.Enums;
using Aquri.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Bookings
{
    /// <summary>Creates a new booking after validating room availability.</summary>
    public record CreateBookingCommand(
        int PropertyId,
        int GuestId,
        int RoomId,
        DateTime CheckIn,
        DateTime CheckOut,
        int Guests,
        decimal RatePerNight,
        string Source) : IRequest<Result<BookingDto>>;

    public class CreateBookingHandler : IRequestHandler<CreateBookingCommand, Result<BookingDto>>
    {
        private readonly IApplicationDbContext _context;

        public CreateBookingHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<BookingDto>> Handle(CreateBookingCommand request, CancellationToken cancellationToken)
        {
            var room = await _context.Rooms.FindAsync(request.RoomId);
            if (room is null)
                return Result<BookingDto>.Failure("Room not found.");

            // The booking's PropertyId is client-supplied, so verify the room
            // actually belongs to that property — otherwise a caller could stamp
            // a booking onto a different property than its room.
            if (room.PropertyId != request.PropertyId)
                return Result<BookingDto>.Failure("Room does not belong to the specified property.");

            var guest = await _context.Guests.FindAsync(request.GuestId);
            if (guest is null)
                return Result<BookingDto>.Failure("Guest not found.");

            // Check room availability (same-day overlap check)
            var overlapping = await _context.Bookings
                .AnyAsync(b => b.RoomId == request.RoomId &&
                    b.Status != BookingStatus.Cancelled &&
                    b.CheckIn < request.CheckOut &&
                    b.CheckOut > request.CheckIn);

            if (overlapping)
                return Result<BookingDto>.Failure("Room is not available for the selected dates.");

            try
            {
                var booking = new Booking(request.PropertyId, request.GuestId, request.RoomId,
                    request.CheckIn, request.CheckOut, request.Guests, request.RatePerNight, request.Source);

                _context.Bookings.Add(booking);
                room.ChangeStatus(RoomStatus.Occupied);
                await _context.SaveChangesAsync(cancellationToken);

                return Result<BookingDto>.SuccessResult(BookingDto.FromEntity(booking));
            }
            catch (DomainException ex)
            {
                return Result<BookingDto>.Failure(ex.Message);
            }
            catch (ArgumentException ex)
            {
                return Result<BookingDto>.Failure(ex.Message);
            }
        }
    }
}
