import { connect } from "livekit-client";

const room = await connect(LIVEKIT_URL, token);

room.localParticipant.setCameraEnabled(true);
room.localParticipant.setMicrophoneEnabled(true);
