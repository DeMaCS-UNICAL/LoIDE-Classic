// LoIDE Web Server API URL
const APIUrl = "localhost:8084";

var socket = undefined;

const createSocket = (callbackErrorConnection) => {
    if (!socket) {
        socket = io(APIUrl, { reconnection: false });
        socket.io.on(APIWSEvents.on.connectError, (error) => {
            console.error(Errors.ConnectionError);
            callbackErrorConnection({ reason: Errors.ConnectionError });
        });
    }
};

const setRunProjectListener = (callbackOutput, callbackProblem) => {
    if (socket) {
        socket.off(APIWSEvents.on.problem);
        socket.off(APIWSEvents.on.output);

        socket.on(APIWSEvents.on.problem, (response) => {
            callbackProblem(response);
        });

        socket.on(APIWSEvents.on.output, (response) => {
            callbackOutput(response);
        });
    }
};

const setGetLanguagesListener = (callbackLanguages) => {
    if (socket) {
        socket.off(APIWSEvents.on.languages);
        socket.on(APIWSEvents.on.languages, (response) => {
            let data = JSON.parse(response);
            callbackLanguages(data);
        });
    }
};

const emitGetLanguages = () => {
    if (socket) {
        if (socket.disconnected) {
            socket.connect();
        }
        socket.emit(APIWSEvents.emit.getLanguages);
    }
};

const emitRunProject = (data) => {
    if (socket) {
        if (socket.disconnected) socket.connect();
        socket.emit(APIWSEvents.emit.run, JSON.stringify(data));
    }
};

const isConnected = () => {
    if (socket) {
        return socket.connected;
    }
    return false;
};

const disconnectAndClearSocket = () => {
    if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
    }
};

// eslint-disable-next-line no-unused-vars
const API = {
    createSocket,
    isConnected,
    disconnectAndClearSocket,
    setRunProjectListener,
    setGetLanguagesListener,
    emitRunProject,
    emitGetLanguages,
};
