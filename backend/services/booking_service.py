def clear_inherited_blocks(freelancer_id, day, start_label, duration_minutes):
    """
    Clears inherited booked blocks for a specific appointment start time.
    """
    all_times = MasterTimeSlot.query.order_by(MasterTimeSlot.id).all()
    time_labels = [t.label for t in all_times]

    try:
        start_index = time_labels.index(start_label)
        blocks = duration_minutes // 15
        inherited_labels = time_labels[start_index + 1 : start_index + blocks]

        for label in inherited_labels:
            inherited_slot = TimeSlot.query.filter_by(
                freelancer_id=freelancer_id,
                day=day,
                master_time_id=next(
                    (mt.id for mt in all_times if mt.label == label), None
                ),
            ).first()

            if inherited_slot:
                inherited_slot.is_booked = False

    except Exception as e:
        print("⚠️ Error clearing inherited blocks:", e)