"""Part 1 check: render every SFX recipe one after another into audio/sfx_demo.wav."""
import numpy as np
import engine as E

items = [
    ('clock tick', E.clock_tick()), ('low boom', E.low_boom()), ('door', E.door_thump()), ('braam', E.braam()),
    ('room tone', E.room_tone(0.4)), ('reverse riser', E.reverse_riser()), ('impact', E.impact()), ('shimmer', E.shimmer()),
    ('whoosh', E.whoosh()[0]), ('counter tick', E.counter_tick(3)), ('tonal hit', E.tonal_hit()), ('glass tap', E.glass_tap()),
    ('jet flyby', E.jet_flyby()[0]), ('ticket print', E.ticket_print()), ('capacity', E.capacity_rise(2.5)), ('chat', E.chat_thock()),
    ('tape swell', E.tape_swell()), ('data tick', E.data_tick(2)), ('cymbal swell', E.cymbal_swell()), ('final hit', E.final_hit()),
]
total = sum(len(x) for _, x in items) + len(items) * E.SR // 2
bus = np.zeros((total, 2))
pos = 0.0
for name, x in items:
    E.place(bus, x, pos, 0.5)
    pos += len(x) / E.SR + 0.5
bus /= max(1e-9, np.abs(bus).max()) / 0.7
E.write('sfx_demo.wav', bus)
print(f'{len(items)} recipes, {pos:.1f} s, peak ok, no NaN: {not np.isnan(bus).any()}')
