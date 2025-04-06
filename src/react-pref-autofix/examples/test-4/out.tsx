import ListDataArrayAlias, { ModalInfoType, Modal } from "./../modal.tsx";
import { useMemo, useCallback, useState } from "react";


function Test4() {

    const [size, setSize] = useState(10)

    const innerGenList = useCallback(() => {
        return [
            {
                id: 'asd',
                message: 'hello'
            }
        ]
    }, []);

    const innerGenInfo = useCallback((size: number) => {
        return {
            size: size + 20
        }
    }, []);

    
    const modalInfo = useMemo<ModalInfoType | undefined>(() => { return genInfo(size); }, [size]);
    
    const modalList = useMemo<ListDataArrayAlias | undefined>(() => { return innerGenList(); }, [innerGenList]);
    
    const modalInfo1 = useMemo<ModalInfoType | undefined>(() => { return innerGenInfo(size); }, [innerGenInfo, size]);
    
    const modalList1 = useMemo<ListDataArrayAlias | undefined>(() => { return new ListFactory({ id: '23', message: size + '' }).list; }, [size]);
    return <>

        <Modal list={ModalList}
               info={modalInfo}
        />

        <Modal list={modalList}
               info={modalInfo1}
        />


        <Modal info={ModalInfo}
               list={modalList1}
               pattern={ModalPattern}
        />
    </>
}

class ListFactory {
    list: ListDataArrayAlias = [];
    constructor(item: {id: string, message: string}) {
        this.list.push(item)
    }
}

class InfoFactory {
    size: number;

    constructor(size: number) {
        this.size = size + 10;
    }
}

function genList() {
    return [
        {
            id: 'asd',
            message: 'hello'
        }
    ]
}

function genInfo(size: number) {
    return {
        size
    }
}
const ModalPattern: RegExp | undefined = new RegExp('^[a-z]', 'g');
const ModalList: ListDataArrayAlias | undefined = genList();
const ModalInfo: ModalInfoType | undefined = new InfoFactory(30);


