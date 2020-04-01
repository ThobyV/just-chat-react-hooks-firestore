import React, { createContext, useReducer, useContext, useEffect, useState } from "react";
import firebase from './Firebase/firebaseConfig'
import {
    usersCollection,
    chatsCollection
} from './Firebase/firebaseConfig'

const setConversationByListener = (payload, conversations) => {
    var convExists = conversations.find(val => val.conversation_uid === payload[0].conversation_uid);
    return convExists ? conversations : [...payload, ...conversations];
}

const updateConversations = (payload, conversations) => {
    var { conversation_uid, messages } = payload[0];
    var convExists = conversations.find(val => val.conversation_uid === conversation_uid);
    return convExists ? conversations.map(target_conv => {
        if (target_conv.conversation_uid === conversation_uid) {
            return {
                ...target_conv,
                messages: [...messages]
            }
        }
        return target_conv;
    }) : conversations
}

const updateMessage = (payload, conversations) => {
    return conversations.map(conv => {
        if (conv.conversation_uid === payload.channel_id) {
            conv.messages = conv.messages.map(_msg => {
                if (_msg.message_id === payload.message_id) {
                    _msg.read = true
                    return _msg
                }
                return _msg;
            })
        }
        return conv;
    })
}

const updateStaticUnreadCount = (conversation_uid, conversations) => {
    return conversations.map(conv => {
        if (conv.conversation_uid === conversation_uid) {
            return {
                ...conv,
                unread_messages_count: 0,
            }
        }
        return conv;
    })
}

const updateConvTypingState = (payload, conversations_typingStates) => {
    var payload_conv_uid = Object.keys(payload)[0] //return cuid string
    var hasConversationTypingState = conversations_typingStates.find((state) => {
        return state.hasOwnProperty(payload_conv_uid)
    })
    if (hasConversationTypingState) {
        return conversations_typingStates.map((conv_state) => {
            if (conv_state.hasOwnProperty(payload_conv_uid)) {
                return {
                    [payload_conv_uid]: {
                        TYPING_STATUS: {
                            ...payload[payload_conv_uid].TYPING_STATUS,
                        }
                    }
                }

            }
            return conv_state;
        })
    } else {
        return [payload, ...conversations_typingStates]
    }
}

const setMessage = (new_messages, arr) => {
    let findByUID = (conv) => conv.conversation_uid === new_messages[0].channel_id;
    let copiedArr = [...arr];
    let prevConv = copiedArr.find(findByUID);
    let prevConvIndex = copiedArr.findIndex(findByUID);
    let newConv = { ...prevConv, messages: [...prevConv.messages, ...new_messages] }
    copiedArr.splice(prevConvIndex, 1); //remove duplicate values
    let newArr = [newConv, ...copiedArr]
    return newArr;
}

const setPaginatedMessages = (new_messages, arr) => {
    let updatedconvArray = arr.map(conv => {
        if (conv.conversation_uid === new_messages[0].channel_id) {
            return {
                ...conv,
                messages: [...new_messages, ...conv.messages]
            }
        }
        return conv;
    });
    return updatedconvArray;
}

const AuthContext = createContext();

const ChatContext = createContext();

const initialState = {
    conversations: [],
    conversations_by_typingState: [],
    conversation_listener_uids: [],
    initialized: false,
}

const reducer = (state, action) => {

    switch (action.type) {
        case "SET_CONVERSATIONS":
            return {
                ...state,
                conversations: [...action.payload, ...state.conversations],
            };
        case "UPDATE_CONVERSATIONS":
            return {
                ...state,
                conversations: updateConversations(action.payload, state.conversations)
            }
        case "SET_CONVERSATION_BY_LISTENER":
            return {
                ...state,
                conversations: setConversationByListener(action.payload, state.conversations),
            };
        case "SET_MESSAGE":
            return {
                ...state,
                conversations: setMessage(action.payload, state.conversations),
            };
        case "SET_PAGINATED_MESSAGES":
            return {
                ...state,
                conversations: setPaginatedMessages(action.payload, state.conversations),
            };
        case "UPDATE_MESSAGE":
            return {
                ...state,
                conversations: updateMessage(action.payload, state.conversations)
            };
        case "UPDATE_CONVERSATION_TYPING_STATUS":
            return {
                ...state,
                conversations_by_typingState: updateConvTypingState(action.payload, state.conversations_by_typingState)
            };
        case "CLEAR_STATIC_UNREAD_COUNT":
            return {
                ...state,
                conversations: updateStaticUnreadCount(action.payload, state.conversations)
            };
        case "INITIALIZE_STATE":
            return {
                ...state,
                initialized: true,
            };
        case "SET_LISTENER_UIDS":
            return {
                ...state,
                conversation_listener_uids: [...action.payload, ...state.conversation_listener_uids],
            };
        default:
            throw new Error();
    }
};

const ChatProvider = ({ children }) => {
    const [authUser] = useAuthState();
    const [loading, setLoading] = useState(false);
    const [state, dispatch] = useReducer(reducer, initialState);

    let findContactDetails = (arr, user_id) => arr.find(obj => obj.uid !== user_id)

    useEffect(() => {
        async function getConversations(auth_user_uid) {
            if (authUser.uid) {
                try {
                    setLoading(true);
                    console.log(auth_user_uid)
                    let conversationsWithUser = await chatsCollection
                        .where("conversation_participants_uid", "array-contains", `${auth_user_uid}`)
                        .limit(15)
                        .get();

                    if (conversationsWithUser.empty) {
                        setLoading(false);
                    }
                    let conversationsBucket = [];
                    conversationsWithUser.docs.forEach(async doc => {
                        let contactDetails = findContactDetails(doc.data().conversation_participants_details, auth_user_uid);
                        let unread_messages_count = await chatsCollection
                            .doc(doc.id)
                            .collection("messages")
                            .where("read", "==", false)
                            .where("sender_uid", "==", `${contactDetails.uid}`)
                            .get();

                        console.log(unread_messages_count)
                        conversationsBucket.push({
                            conversation_uid: doc.id,
                            conversation_participants_uid: doc.data().conversation_participants_uid,
                            conversation_participants_details: doc.data()
                                .conversation_participants_details,
                            messages: [],
                            timestamp: doc.data().timestamp,
                            createdAt: doc.data().createdAt,
                            most_recent_message_snapshot: doc.data().most_recent_message_snapshot,
                            TYPING_STATUS: doc.data().TYPING_STATUS,
                            unread_messages_count: unread_messages_count.docs.length,
                        });
                        if (conversationsBucket.length === conversationsWithUser.docs.length) {
                            setLoading(false);
                            dispatch({ type: 'SET_CONVERSATIONS', payload: conversationsBucket, })
                        }
                    });
                } catch (error) {
                    console.log(error);
                    dispatch({ type: 'INITIALIZE_STATE' })
                }
                dispatch({ type: 'INITIALIZE_STATE' })
            }
        }

        getConversations(authUser.uid);
    }, [authUser]);

    useEffect(() => {
        async function onConversationListener(auth_user_uid) {
            if (authUser.uid) {
                try {
                    let counter = 0;
                    await chatsCollection
                        .where("conversation_participants_uid", "array-contains", `${auth_user_uid}`)
                        .onSnapshot(querySnapshot => {
                            counter++;
                            querySnapshot.docChanges().forEach(
                                change => {
                                    if (counter >= 2) {
                                        let doc = change.doc.data();
                                        let conversation = {
                                            conversation_uid: doc.conversation_uid,
                                            conversation_participants_uid: doc.conversation_participants_uid,
                                            conversation_participants_details: doc.conversation_participants_details,
                                            messages: [],
                                            timestamp: doc.timestamp,
                                            createdAt: doc.createdAt,
                                            first_message: doc.first_message,
                                            first_sender_uid: doc.first_sender_uid,
                                            most_recent_message_snapshot: doc.most_recent_message_snapshot,
                                        };

                                        if (change.type === "added") {
                                            dispatch({ type: "SET_CONVERSATION_BY_LISTENER", payload: [conversation] })
                                        }
                                        if (change.type === "modified") {
                                            dispatch({ type: "SET_CONVERSATION_BY_LISTENER", payload: [conversation] })
                                        }
                                        dispatch({
                                            type: "UPDATE_CONVERSATION_TYPING_STATUS",
                                            payload: {
                                                [doc.conversation_uid]: {
                                                    TYPING_STATUS: doc.TYPING_STATUS,
                                                }
                                            }
                                        })
                                    }
                                },
                                error => {
                                    console.log(error, "listener has stopped listening");
                                }
                            );
                        });
                } catch (error) {
                    console.log(error);
                }
            }
        }

        onConversationListener(authUser.uid);
    }, [authUser]);

    useEffect(() => {
        async function onMessageListener() {
            if (state.conversations.length && authUser.uid) {
                try {
                    let newUIDs = [];
                    state.conversations.forEach(async function ({ conversation_uid }, index, array) {
                        let counter = 0;
                        let endOfArray = (index === array.length - 1)
                        if (
                            !state.conversation_listener_uids.includes(conversation_uid)
                        ) {
                            newUIDs.push(conversation_uid);
                            await chatsCollection
                                .doc(conversation_uid)
                                .collection("messages")
                                .onSnapshot(querySnapshot => {
                                    counter++;
                                    if (counter >= 2) {
                                        querySnapshot.docChanges().forEach(
                                            change => {
                                                if (change.type === "added") {
                                                    dispatch({
                                                        type: "SET_MESSAGE",
                                                        payload: [{
                                                            message_id: change.doc.id,
                                                            ...change.doc.data(),
                                                        }],
                                                    });
                                                    console.log("i have been triggered")
                                                }

                                                if (change.type === "modified") {
                                                    dispatch({
                                                        type: "UPDATE_MESSAGE",
                                                        payload: {
                                                            message_id: change.doc.id,
                                                            ...change.doc.data(),
                                                        },
                                                    });
                                                    console.log("i have been triggered too")
                                                }
                                            },
                                            error => {
                                                console.log(error, "listener has stopped listening");
                                            }
                                        );
                                    }
                                });
                        }
                        //Dispatch once at the end of array to avoid dispatching each time
                        if (endOfArray) {
                            dispatch({
                                type: "SET_LISTENER_UIDS",
                                payload: newUIDs,
                            })
                        }
                    });
                } catch (error) {
                    console.log(error);
                }
            }
        }
        onMessageListener()
    }, [state.conversations.length])

    return (
        <ChatContext.Provider value={[state, dispatch, loading]}>
            {children}
        </ChatContext.Provider>)
}

const AuthProvider = ({ children }) => {
    const [authUser, setAuthUser] = useState({});
    const [loading, setLoading] = useState(true);

    const addUserToUsersCollection = (data) => usersCollection.doc(data.uid).set(data);
    let colors = ["pink-flamingo", "brilliant-cyan", "faux-rose", "sweet-purple"];
    let randomColor = colors[Math.floor(Math.random() * colors.length)];
    console.log(authUser);

    useEffect(() => {
        const unsubscribe = firebase.auth().onAuthStateChanged((currentUser) => {
            if (currentUser) {
                const { displayName, uid } = currentUser;
                const authUserFx = async () => {
                    try {
                        await addUserToUsersCollection({ displayName, uid, placeholderColor: randomColor })
                        setLoading(false);
                        setAuthUser({ displayName, uid, placeholderColor: randomColor });
                    } catch (error) {
                        setLoading(false);
                        console.log(error);
                    }
                }
                authUserFx();
            } else {
                setLoading(false);
            }
        })
        return () => unsubscribe();
    }, [])

    return (
        <AuthContext.Provider value={[authUser, loading, setLoading]}>
            {children}
        </AuthContext.Provider>
    );
}

const useChatState = () => useContext(ChatContext);

const useAuthState = () => useContext(AuthContext);

export {
    ChatProvider,
    AuthProvider,
    useChatState,
    useAuthState,
}