package gov.nih.nci.cagrid.data.cql.validation;

/**
 * 
 * This class implements the DomainModelLoader interface and will load a domain
 * model using a remote service.
 * 
 * The default implementation will load a caDSR domain model using the caGrid
 * discovery service. The discovery service is the only way for clients to
 * retreive a domain model for a given DS
 * @version 1.0
 * @created 30-May-2006 4:41:07 PM
 */
public class RemoteDomainModelLoader implements DomainModelLoader {

	public RemoteDomainModelLoader(){

	}

	public void finalize() throws Throwable {

	}

	/**
	 * Will try and load a caDSR domain model for a given DS EPR. The model will be
	 * loaded either by using the caGrid Discovery API (through the index). Can throw
	 * an exception if model is not available
	 * 
	 * @param DataServiceEndPoint
	 */
	public RemoteDomainModelLoader(EPR DataServiceEndPoint){

	}

	/**
	 * 
	 * Can return exception if unable to load a domain model
	 */
	public DomainModel load(){
		return null;
	}

}