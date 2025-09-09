import ListDataArrayAlias, { ModalInfoType, Modal } from "./../../../../share-comps/modal.tsx";
import { useCallback, useMemo, useState } from "react";


function MyComponent() {

    const [size, setSize] = useState(10);
    const [message, setMessage] = useState('firstOne')
    const [id, setId] = useState('one')
    
    
    
    const doYourJob = useCallback(() => {
        console.log("=>(in.tsx:12) hello job", );
    }, []);
    
    const handleYourDuty = (content: string) => {
        console.log(`=>(in.tsx:19) duty ${content}`, );
    }
    
    const onAddToSubjectClick = (targetSubject: string) => {
    
    }
    
    const subjectList = useMemo(()=>{
        return []
    },[])

    
    
    const modalInfo = useMemo<ModalInfoType | undefined>(() => { return { size }; }, [size]);
    
    const modalList = useMemo<ListDataArrayAlias | undefined>(() => { return [{ id: 'second', message }]; }, [message]);
    
    const handleModalClick = useCallback<(Parameters<typeof Modal>[0]["onClick"]) & Function>((e) => {
        doYourJob();
        // handleYourDuty('Man!');
        // console.log("=>(in.tsx:14) e.count", e.count, size);
    }, [doYourJob]);
    return <>
        <Modal info={modalInfo}
               list={modalList}
               onClick={handleModalClick}
               
        />
        {
            subjectList.map(elem => <Modal onClose={() => {onAddToSubjectClick(elem)}}></Modal>)
        }
    </>
}



function Input (props: { onChange?: (e: { value: string }) => void }) {
    return <></>
}