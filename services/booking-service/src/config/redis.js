const connection = require('../../../../shared/redis')(require('redis'));
const { fail } = require('../../../../shared/http');
const metrics = { holdsAttempted: 0, holdsAcquired: 0, conflictsPrevented: 0, bookingsConfirmed: 0 };
const keys = (eventId, seatId) => [`hold:{${eventId}}:${seatId}`, `holds:{${eventId}}`, `inventory:{${eventId}}`];
const HOLD = `
local now=redis.call('TIME'); local ms=now[1]*1000+math.floor(now[2]/1000)
redis.call('ZREMRANGEBYSCORE',KEYS[2],'-inf',ms)
local seats=cjson.decode(ARGV[5]); local fresh=0; local ttl=tonumber(ARGV[2])
for i,seat in ipairs(seats) do
 local owner=redis.call('GET',KEYS[i+3])
 if owner and owner~=ARGV[1] then return {0,0} end
 if owner then ttl=math.min(ttl,redis.call('PTTL',KEYS[i+3])) else fresh=fresh+1 end
end
local available=math.max(0,tonumber(ARGV[3])-tonumber(ARGV[4])-redis.call('ZCARD',KEYS[2]))
if available<fresh then return {-1,0} end
for i,seat in ipairs(seats) do
 redis.call('SET',KEYS[i+3],ARGV[1],'PX',ttl)
 redis.call('ZADD',KEYS[2],ms+ttl,seat)
end
redis.call('SET',KEYS[3],available-fresh,'EX',1200)
redis.call('EXPIRE',KEYS[2],1200); return {1,ttl}`;
const RELEASE = `
local seats=cjson.decode(ARGV[2]); local released=0
for i,seat in ipairs(seats) do
 if redis.call('GET',KEYS[i+3])==ARGV[1] then
  redis.call('DEL',KEYS[i+3]); redis.call('ZREM',KEYS[2],seat); released=released+1
 end
end
return released`;
const CLAIM = `
local seats=cjson.decode(ARGV[3])
for i,seat in ipairs(seats) do
 local owner=redis.call('GET',KEYS[i+3])
 if owner~=ARGV[1] and owner~=ARGV[2] then return 0 end
end
local now=redis.call('TIME')
for i,seat in ipairs(seats) do
 redis.call('SET',KEYS[i+3],ARGV[2],'XX','EX',30)
 redis.call('ZADD',KEYS[2],now[1]*1000+30000,seat)
end
return 1`;
const batchKeys = (eventId, seats) => [...keys(eventId, seats[0]), ...seats.map(seat => keys(eventId, seat)[0])];
const seatList = seats => Array.isArray(seats) ? seats : [seats];
function ensure() { if (!connection.ready()) throw fail(503, 'Reservations are temporarily paused. Redis is unavailable.'); }
module.exports = {
  ...connection,
  metrics,
  acquire: async (eventId, seatId, userId, capacity, booked) => {
    ensure(); metrics.holdsAttempted++;
    const [result, ttl] = await connection.client.eval(HOLD, { keys: batchKeys(eventId, seatList(seatId)), arguments: [userId, '600000', String(capacity), String(booked), JSON.stringify(seatList(seatId))] });
    if (result <= 0) { metrics.conflictsPrevented++; throw fail(409, result === -1 ? 'This event is sold out.' : 'Another guest is holding this seat. Choose another.'); }
    if (result === 1) metrics.holdsAcquired++;
    return Math.ceil(ttl / 1000);
  },
  release: async (eventId, seatId, owner) => {
    ensure(); return connection.client.eval(RELEASE, { keys: batchKeys(eventId, seatList(seatId)), arguments: [owner, JSON.stringify(seatList(seatId))] });
  },
  claim: async (eventId, seatId, owner, claimOwner) => {
    ensure(); return connection.client.eval(CLAIM, { keys: batchKeys(eventId, seatList(seatId)), arguments: [owner, claimOwner, JSON.stringify(seatList(seatId))] });
  },
  locks: async eventId => {
    ensure(); const key = `holds:{${eventId}}`;
    const seats = await connection.client.zRangeByScore(key, Date.now(), '+inf');
    const values = await Promise.all(seats.map(async seatId => ({ seatId, owner: await connection.client.get(keys(eventId, seatId)[0]), ttl: await connection.client.ttl(keys(eventId, seatId)[0]) })));
    return values.filter(v => v.owner && v.ttl > 0);
  }
};
