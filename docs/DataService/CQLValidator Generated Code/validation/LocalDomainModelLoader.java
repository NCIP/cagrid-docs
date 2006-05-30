package gov.nih.nci.cagrid.data.cql.validation;

/**
 * This will load a domain model from the local file system.
 * 
 * Class can be used when caDSR domain model extract is locally available
 * @version 1.0
 * @created 30-May-2006 4:41:07 PM
 */
public class LocalDomainModelLoader implements DomainModelLoader {

	public LocalDomainModelLoader(){

	}

	public void finalize() throws Throwable {

	}

	/**
	 * 
	 * Will load a caDSR domain model from a give file. Can throw an excpetion if
	 * unable to locate file
	 * 
	 * @param modelFile
	 */
	public LocalDomainModelLoader(java.io.File modelFile){

	}

	/**
	 * 
	 * Can return exception if unable to load a domain model
	 */
	public DomainModel load(){
		return null;
	}

}