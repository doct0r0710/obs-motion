# obs-motion
Detects motion on OBS source and saves replay buffer using OBS Websockets.

# Usage

## OBS 
1. Make sure you have at least one Source added.
2. Make sure Replay Buffer is enabled.
3. Make sure WebSocket Server is enabled.
4. Make sure Replay Buffer is started.

## index.js
1. Change necessary OBS settings between lines 7 and 12.
2. Start the project with `npm start` or `node index.js`
3. Fine-tune settings between lines 13 and 15, if necessary. 
- Increase `motionLimit` if too sensitive, decrease if not sensitive enough.
- Increase `imageInterval` if performance is too slow, decrease to catch faster motion.
- Increase `avgSize` if the scene is too noisy, decrease to catch smaller movement.
4. Disable `debug` on line 17 if necessary.