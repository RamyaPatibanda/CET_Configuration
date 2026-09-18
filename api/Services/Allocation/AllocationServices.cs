public interface IAllocationStage
{
    string StageCode { get; }
    Task ExecuteAsync(AllocationContext context, CancellationToken cancellationToken = default);
}

public interface ISeatInventory
{
    bool TryReserve(SeatInventory seat, string allocatedType, bool specialReservation);
    void Release(SeatInventory seat, string allocatedType, bool specialReservation);
}

public sealed class SeatInventoryService : ISeatInventory
{
    public bool TryReserve(SeatInventory seat, string allocatedType, bool specialReservation)
    {
        if (specialReservation)
        {
            var available = allocatedType switch
            {
                "PH" => seat.Ph,
                "Def" => seat.Defence,
                "Orp" => seat.Orphan,
                _ => 0
            };
            if (available <= 0) return false;

            switch (allocatedType)
            {
                case "PH": seat.Ph--; break;
                case "Def": seat.Defence--; break;
                case "Orp": seat.Orphan--; break;
            }

            return true;
        }

        if (allocatedType == "Fem")
        {
            if (seat.Female <= 0) return false;
            seat.Female--;
            return true;
        }

        if (allocatedType != "Gen" || seat.General <= 0) return false;
        seat.General--;
        return true;
    }

    public void Release(SeatInventory seat, string allocatedType, bool specialReservation)
    {
        if (specialReservation)
        {
            switch (allocatedType)
            {
                case "PH": seat.Ph++; break;
                case "Def": seat.Defence++; break;
                case "Orp": seat.Orphan++; break;
            }
            return;
        }

        if (allocatedType == "Fem") seat.Female++;
        else if (allocatedType == "Gen") seat.General++;
    }
}
