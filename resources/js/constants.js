/* eslint-disable no-unused-vars */
const APIWSEvents = {
    emit: {
        run: "run",
        getLanguages: "getLanguages",
    },
    on: {
        connectError: "error",
        problem: "problem",
        output: "output",
        languages: "languages",
    },
};

const Errors = {
    ConnectionError:
        "Unable to connect to the server, maybe you or the server are offline.\nTry it later.",
    RunConnectError:
        "Falied to run the project. Maybe the server or you are offline.\nTry it later.",
    GetLanguagesError:
        "Falied to get the languages. Maybe the server or you are offline.\nTry it later.",
};
