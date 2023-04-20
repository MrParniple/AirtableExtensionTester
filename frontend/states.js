import { createContext, useContext, useState } from "react";

const ExtensionStateContext = createContext();

export const useExtensionState = () => {
  const context = useContext(ExtensionStateContext);
  if (!context) {
    throw new Error(
      "useExtensionState must be used within an ExtensionStateProvider"
    );
  }
  return context;
};

export const ExtensionStateProvider = ({ children }) => {
  const [apiKey, setApiKey] = useState(
    localStorage.getItem("tableMateApiKey") || ""
  );

  const [showApiKey, setShowApiKey] = useState(false);

  const [isApiEntered, setIsApiEntered] = useState(
    !!localStorage.getItem("tableMateApiKey")
  );

  const [isHelpVisible, setIsHelpVisible] = useState(false);

  const [disableFields, setDisableFields] = useState(true);

  const [chatGptApiKey, setChatGptApiKey] = useState(
    sessionStorage.getItem("chatgptKey") || ""
  );

  const [inputText, setInputText] = useState("");

  const [response, setResponse] = useState("");

//gptkey
//tablematekey
//help

const [helpVisibility, setHelpVisibility] = useState(false);
const [tableMateKeyVerified, setTableMateKeyVerified] = useState(false);
const [gptkeyVerified, setGptkeyVerified] = useState(false);
const [planValid, setPlanValid] = useState(false);

let tableMateKey = "";
let gptkey = "";

  return (
    <ExtensionStateContext.Provider
      value={{
        apiKey, setApiKey,
        showApiKey, setShowApiKey,
        isApiEntered, setIsApiEntered,
        isHelpVisible, setIsHelpVisible,
        disableFields, setDisableFields,
        chatGptApiKey, setChatGptApiKey,
        inputText, setInputText,
        response, setResponse,
      }}
    >
      {children}
    </ExtensionStateContext.Provider>
  );
};
